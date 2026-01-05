const Room = require("../models/room");

const createRoomController = async (req, res) => {
  try {
    const { roomCode, hostName, users } = req.body;

    if (!roomCode || !hostName) {
      return res
        .status(400)
        .json({ error: "roomCode and hostName are required" });
    }

    // Check if room already exists
    let existing = await Room.findOne({ roomCode });
    if (existing) {
      return res.status(400).json({ error: "Room already exists" });
    }

    // Create new room
    const newRoom = new Room({
      roomCode,
      hostName,
      users: users && users.length > 0 ? users : [hostName],
    });

    await newRoom.save();
    return res.status(201).json(newRoom);
  } catch (err) {
    console.error("❌ Error creating room:", err.message);
    res.status(500).json({ error: "Failed to create room" });
  }
};

const fetchRoomController = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });

    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
  } catch (err) {
    console.error("❌ Error fetching room:", err.message);
    res.status(500).json({ error: "Failed to fetch room" });
  }
};

const joinRoomController = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username)
      return res.status(400).json({ error: "username is required" });

    const room = await Room.findOne({
      roomCode: req.params.roomCode.toUpperCase(),
    });
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (!room.users.includes(username)) {
      room.users.push(username);
      await room.save();
    }

    res.json(room);
  } catch (err) {
    console.error("❌ Error joining room:", err.message);
    res.status(500).json({ error: "Failed to join room" });
  }
};

const getUsersController = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json({ users: room.users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteRoomController = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { username } = req.body; // Host must provide their username

    if (!username) {
      return res.status(400).json({ error: "username is required" });
    }

    const normalizedRoomCode = roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode: normalizedRoomCode });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Verify that the requester is the host
    if (room.hostName !== username) {
      return res.status(403).json({
        error: "Only the host can delete the room",
      });
    }

    // Notify all connected users via Socket.IO
    if (io) {
      io.in(normalizedRoomCode).emit("roomDeleted", {
        message: "Room has been deleted by the host.",
      });

      // Disconnect all users in the room
      const sockets = await io.in(normalizedRoomCode).fetchSockets();
      for (const socket of sockets) {
        socket.leave(normalizedRoomCode);
        socket.disconnect(true);
      }
    }

    // 🔥 Delete all messages for this room
    const Message = require("../models/message");
    await Message.deleteMany({ roomCode: normalizedRoomCode });
    console.log(`🗑️ Deleted messages for room: ${normalizedRoomCode}`);

    // Delete the room from database
    await Room.deleteOne({ roomCode: normalizedRoomCode });

    console.log(`🗑️ Room ${normalizedRoomCode} deleted by host ${username}`);

    return res.status(200).json({
      message: "Room deleted successfully",
      roomCode: normalizedRoomCode,
    });
  } catch (err) {
    console.error("❌ Error deleting room:", err.message);
    res.status(500).json({ error: "Failed to delete room" });
  }
};

module.exports = {
  createRoomController,
  fetchRoomController,
  joinRoomController,
  getUsersController,
  deleteRoomController,
};
