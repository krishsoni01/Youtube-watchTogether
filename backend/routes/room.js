const express = require("express");
const router = express.Router();
const Room = require("../models/room");

// ===============================
// POST /api/rooms  -> create room
// ===============================
router.post("/", async (req, res) => {
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
});

// ===============================
// GET /api/rooms/:roomCode -> fetch room
// ===============================
router.get("/:roomCode", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ roomCode: roomCode.toUpperCase() });

    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
  } catch (err) {
    console.error("❌ Error fetching room:", err.message);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// ===============================
// PUT /api/rooms/:roomCode/join -> add user
// ===============================
router.put("/:roomCode/join", async (req, res) => {
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
});

// GET /api/rooms/:roomCode/users -> get users list of a room
router.get("/:roomCode/users", async (req, res) => {
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
});

module.exports = router;
