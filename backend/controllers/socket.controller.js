const Room = require("../models/room");
const Message = require("../models/message");

const normalizeRoomId = (id) => (id ? id.toUpperCase() : null);

const joinRoomController = (socket, io) => async (data) => {
  let roomIdentifier = normalizeRoomId(data.roomId);
  if (!roomIdentifier) {
    socket.emit("roomError", "No room ID provided.");
    return socket.disconnect(true);
  }

  try {
    const username = socket.data.username;
    const userId = socket.data.userId;

    // Check if room exists
    const existingRoom = await Room.findOne({ roomCode: roomIdentifier });
    const isNewUser =
      !existingRoom || !existingRoom.users.includes(username || userId);

    // Add user to room
    await Room.findOneAndUpdate(
      { roomCode: roomIdentifier },
      {
        $addToSet: { users: username || userId },
        $set: { lastActive: Date.now() },
        $setOnInsert: {
          hostName: username,
          isPlaying: false,
          currentTime: 0,
        },
      },
      { new: true, upsert: true }
    );

    // Fetch latest room state
    const latestRoom = await Room.findOne({ roomCode: roomIdentifier });

    if (!latestRoom) {
      socket.emit("roomError", "Room not found.");
      return socket.disconnect(true);
    }

    // Join room
    socket.join(roomIdentifier);
    console.log(`${username} joined room: ${roomIdentifier}`);

    // 🔥 Load previous messages for this room
    const previousMessages = await Message.find({
      roomCode: roomIdentifier,
    })
      .sort({ createdAt: 1 }) // Oldest first
      .limit(100) // Optional: limit to last 100 messages
      .lean();

    // Send room state and previous messages
    socket.emit("roomJoined", {
      roomId: roomIdentifier,
      videoId: latestRoom.videoId || null,
      currentTime: latestRoom.currentTime || 0,
      isPlaying: latestRoom.isPlaying || false,
      previousMessages: previousMessages.map((msg) => ({
        id: msg._id,
        username: msg.username,
        message: msg.message,
        ts: msg.createdAt.getTime(),
        userId: msg.userId,
      })),
    });

    // Update user list
    const socketsInRoom = await io.in(roomIdentifier).fetchSockets();
    const clientUsers = socketsInRoom.map((s) => ({
      id: s.data.userId,
      name: s.data.username,
    }));

    io.in(roomIdentifier).emit("userList", clientUsers);

    // Send join message ONLY if new user
    if (isNewUser) {
      const joinMessage = new Message({
        roomCode: roomIdentifier,
        userId: "system",
        username: "System",
        message: `${username} joined the room.`,
      });

      await joinMessage.save();

      io.in(roomIdentifier).emit("chat-message", {
        id: joinMessage._id,
        username: "System",
        message: `${username} joined the room.`,
        ts: joinMessage.createdAt.getTime(),
      });
    }
  } catch (error) {
    console.error(`CRITICAL DB/Room Error:`, error.message);
    socket.emit("roomError", "Failed to join room: " + error.message);
    socket.disconnect(true);
  }
};

const videoActionController = (socket, io) => async ({
  roomId: roomIdentifier,
  action,
  time,
  videoId,
}) => {
  if (!roomIdentifier) return;
  const normalizedId = normalizeRoomId(roomIdentifier);

  // Broadcast to ALL users in the room
  io.in(normalizedId).emit("video-action", { action, time, videoId });

  try {
    const update = {};

    switch (action) {
      case "play":
        update.isPlaying = true;
        if (typeof time === "number") update.currentTime = time;
        break;

      case "pause":
        update.isPlaying = false;
        if (typeof time === "number") update.currentTime = time;
        break;

      case "seek":
        if (typeof time === "number") update.currentTime = time;
        break;

      case "changeVideo":
        if (videoId) update.videoId = videoId;
        update.currentTime = 0;
        update.isPlaying = false;
        break;

      default:
        console.warn(`⚠️ Unknown video action: ${action}`);
        return;
    }

    if (Object.keys(update).length > 0) {
      await Room.findOneAndUpdate(
        { roomCode: normalizedId },
        { $set: { ...update, lastActive: Date.now() } },
        { new: true }
      );
      console.log(`🟢 Updated room ${normalizedId}:`, update);
    }
  } catch (err) {
    console.error("❌ DB update error on video-action:", err.message);
    socket.emit("roomError", "Database update failed, please retry.");
  }
};

const chatMessageController = (socket, io) => async ({ roomId: roomIdentifier, message }) => {
  if (!roomIdentifier) return;
  const normalizedId = normalizeRoomId(roomIdentifier);
  const username = socket.data.username || "Anon";
  const userId = socket.data.userId;

  try {
    // Save message to database
    const newMessage = new Message({
      roomCode: normalizedId,
      userId: userId,
      username: username,
      message: message,
    });

    await newMessage.save();

    // Broadcast message with ID
    io.in(normalizedId).emit("chat-message", {
      id: newMessage._id,
      username,
      message,
      ts: newMessage.createdAt.getTime(),
      userId: userId,
    });

    // Update room activity
    await Room.findOneAndUpdate(
      { roomCode: normalizedId },
      { lastActive: Date.now() }
    );
  } catch (error) {
    console.error("Error saving message:", error.message);
    socket.emit("messageError", "Failed to send message");
  }
};

const disconnectingController = (socket, io) => async () => {
  console.log(`🔌 User disconnecting: ${socket.id} (${socket.data.username})`);

  await new Promise((resolve) => setTimeout(resolve, 50));

  const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
  const disconnectingUser = socket.data.username;
  const userIdentifier = disconnectingUser || socket.data.userId;

  for (const roomIdentifier of rooms) {
    const normalizedId = normalizeRoomId(roomIdentifier);

    // 1. Get the room from DB
    const room = await Room.findOne({ roomCode: normalizedId });

    if (!room) {
      console.log(`⚠️ Room ${normalizedId} not found in DB during disconnect`);
      continue;
    }

    // 2. 🔥 CHECK IF THIS USER IS THE HOST
    if (room.hostName === disconnectingUser) {
      console.log(
        `👑 Host ${disconnectingUser} is leaving room ${normalizedId}. Deleting room...`
      );

      // Notify all users that the room is being closed
      io.in(normalizedId).emit("roomDeleted", {
        message: "Room closed because the host left.",
      });

      // 🔥 Delete all messages for this room
      await Message.deleteMany({ roomCode: normalizedId });
      console.log(`🗑️ Deleted messages for room: ${normalizedId}`);

      // Delete room from database
      await Room.deleteOne({ roomCode: normalizedId });
      console.log(`🗑️ Room ${normalizedId} deleted from database`);

      // Disconnect all remaining users
      const socketsRemaining = await io.in(normalizedId).fetchSockets();
      for (const s of socketsRemaining) {
        s.leave(normalizedId);
        s.disconnect(true);
      }

      console.log(`✅ All users disconnected from room ${normalizedId}`);
      continue; // Skip to next room
    }

    // 3. Handle REGULAR USER LEAVING (not host)
    if (userIdentifier) {
      await Room.findOneAndUpdate(
        { roomCode: normalizedId },
        {
          $pull: { users: userIdentifier },
          $set: { lastActive: Date.now() },
        }
      );
      console.log(
        `👤 Removed user ${userIdentifier} from room ${normalizedId}`
      );
    }

    // 4. Update remaining users list
    const socketsRemaining = await io.in(normalizedId).fetchSockets();
    const users = socketsRemaining
      .filter((s) => s.id !== socket.id)
      .map((s) => ({
        id: s.data.userId,
        name: s.data.username || "Anon",
      }));

    io.in(normalizedId).emit("userList", users);

    // 5. Send leave message
    io.in(normalizedId).emit("chat-message", {
      username: "System",
      message: `${disconnectingUser} left the room.`,
      ts: Date.now(),
    });

    console.log(
      `✅ Updated room ${normalizedId}. Remaining users: ${users.length}`
    );
  }
};

module.exports = {
  joinRoomController,
  videoActionController,
  chatMessageController,
  disconnectingController,
};
