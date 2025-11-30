require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const Room = require("./models/room");
const roomRoutes = require("./routes/room");
const cors = require("cors");
const Message = require("./models/message");

// Try loading auth routes safely
let authRoutes;
try {
  authRoutes = require("./routes/auth");
} catch (err) {
  console.warn("⚠️ Auth routes not found or invalid. Skipping /api/auth.");
}

// =========================================================================
// 1. CRITICAL: GLOBAL ERROR HANDLERS
// =========================================================================
process.on("unhandledRejection", (reason, promise) => {
  console.error("*** CRITICAL: Unhandled Rejection (Async Error) ***");
  console.error("Reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error(
    "*** CRITICAL: Uncaught Exception (Sync Error - Server Crash) ***"
  );
  console.error(err);
  process.exit(1);
});

// =========================================================================
// 2. INITIALIZATION
// =========================================================================
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://watch-together-beta.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://watch-together-beta.vercel.app"
    ],
    credentials: true,
  })
);
app.use(express.json());

// Default route
app.get("/", (req, res) => {
  res.send("Watch Together Server is Running");
});

// AUTH ROUTES
if (authRoutes) {
  app.use("/api/auth", authRoutes);
}

// app.use("/api/rooms", roomRoutes);
app.use("/api/rooms", roomRoutes(io));

// =========================================================================
// 3. HELPER FUNCTION
// =========================================================================
const normalizeRoomId = (id) => (id ? id.toUpperCase() : null);

// =========================================================================
// 4. AUTO-CLEANUP: DELETE INACTIVE ROOMS (> 1 HOUR)
// =========================================================================
// const INACTIVITY_THRESHOLD = 1 * 60 * 1000; // 1 minute in milliseconds
const INACTIVITY_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

const cleanupInactiveRooms = async () => {
  try {
    const cutoffTime = Date.now() - INACTIVITY_THRESHOLD;

    const inactiveRooms = await Room.find({
      lastActive: { $lt: new Date(cutoffTime) },
    });

    if (inactiveRooms.length > 0) {
      console.log(
        `🧹 Found ${inactiveRooms.length} inactive room(s) to clean up`
      );

      for (const room of inactiveRooms) {
        io.in(room.roomCode).emit("roomDeleted", {
          message: "Room closed due to inactivity (1 hour).",
        });

        const sockets = await io.in(room.roomCode).fetchSockets();
        for (const socket of sockets) {
          socket.leave(room.roomCode);
          socket.disconnect(true);
        }

        // 🔥 Delete all messages for this room
        await Message.deleteMany({ roomCode: room.roomCode });
        console.log(`🗑️ Deleted messages for room: ${room.roomCode}`);
      }

      const result = await Room.deleteMany({
        lastActive: { $lt: new Date(cutoffTime) },
      });

      console.log(`✅ Cleaned up ${result.deletedCount} inactive room(s)`);
    }
  } catch (error) {
    console.error("❌ Error during inactive room cleanup:", error.message);
  }
};

setInterval(cleanupInactiveRooms, 10 * 60 * 1000);
// setInterval(cleanupInactiveRooms, 1 * 60 * 1000);

// Run cleanup on server start
cleanupInactiveRooms();

// =========================================================================
// 5. SOCKET.IO CONNECTION LISTENER
// =========================================================================

io.on("connection", (socket) => {
  const { userId, roomId, username: clientName } = socket.handshake.query;

  socket.data.userId = userId || null;
  socket.data.username =
    clientName || `User-${userId ? userId.substring(0, 4) : "Anon"}`;

  console.log(
    `✅ User connected: ${socket.id} (${socket.data.username}, ID: ${
      userId || "none"
    })`
  );

  socket.on("error", (err) => {
    console.error(`Socket Error for ${socket.id}:`, err);
  });

  // --- JOIN ROOM HANDLER ---

  // Update your joinRoom handler to load previous messages
  socket.on("joinRoom", async (data) => {
    let roomIdentifier = normalizeRoomId(data.roomId || roomId);
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
      const previousMessages = await Message.find({ roomCode: roomIdentifier })
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
  });

  socket.on(
    "video-action",
    async ({ roomId: roomIdentifier, action, time, videoId }) => {
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
    }
  );

  socket.on("chat-message", async ({ roomId: roomIdentifier, message }) => {
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
  });

  socket.on("disconnecting", async () => {
    console.log(
      `🔌 User disconnecting: ${socket.id} (${socket.data.username})`
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    const disconnectingUser = socket.data.username;
    const userIdentifier = disconnectingUser || socket.data.userId;

    for (const roomIdentifier of rooms) {
      const normalizedId = normalizeRoomId(roomIdentifier);

      // 1. Get the room from DB
      const room = await Room.findOne({ roomCode: normalizedId });

      if (!room) {
        console.log(
          `⚠️ Room ${normalizedId} not found in DB during disconnect`
        );
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
  });
});

// =========================================================================
// 6. DATABASE AND SERVER STARTUP
// =========================================================================
const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error(
    "❌ No MongoDB URI found in environment (MONGO_URL or MONGO_URI). Exiting."
  );
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("✅ MongoDB Connected");
    server.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });
