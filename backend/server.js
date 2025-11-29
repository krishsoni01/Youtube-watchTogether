require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const Room = require("./models/room");
const roomRoutes = require("./routes/room");
const cors = require("cors");

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
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
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

app.use("/api/rooms", roomRoutes);

// =========================================================================
// 3. HELPER FUNCTION
// =========================================================================
const normalizeRoomId = (id) => (id ? id.toUpperCase() : null);

// =========================================================================
// 4. SOCKET.IO CONNECTION LISTENER
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
  socket.on("joinRoom", async (data) => {
    let roomIdentifier = normalizeRoomId(data.roomId || roomId);
    if (!roomIdentifier) {
      socket.emit("roomError", "No room ID provided.");
      return socket.disconnect(true);
    }

    try {
      const username = socket.data.username;
      const userId = socket.data.userId;

      // 1️⃣ Check if room exists to determine if user is new
      const existingRoom = await Room.findOne({ roomCode: roomIdentifier });
      const isNewUser =
        !existingRoom || !existingRoom.users.includes(username || userId);

      // 2️⃣ Add the user (or create room if not found)
      // 🔥 FIX: When creating a new room, ensure isPlaying is false
      await Room.findOneAndUpdate(
        { roomCode: roomIdentifier },
        {
          $addToSet: { users: username || userId },
          $set: { lastActive: Date.now() },
          $setOnInsert: {
            hostName: username,
            isPlaying: false, // 🔥 NEW: Ensure video doesn't autoplay
            currentTime: 0,
          },
        },
        { new: true, upsert: true }
      );

      // 3️⃣ Fetch latest room state
      const latestRoom = await Room.findOne({ roomCode: roomIdentifier });

      if (!latestRoom) {
        socket.emit("roomError", "Room not found.");
        return socket.disconnect(true);
      }

      // 4️⃣ Join room
      socket.join(roomIdentifier);
      console.log(`${username} joined room: ${roomIdentifier}`);

      // 5️⃣ Send the latest video state to this new user
      socket.emit("roomJoined", {
        roomId: roomIdentifier,
        videoId: latestRoom.videoId || null,
        currentTime: latestRoom.currentTime || 0,
        isPlaying: latestRoom.isPlaying || false, // 🔥 Send actual play state
      });

      // 6️⃣ Update user list for all clients
      const socketsInRoom = await io.in(roomIdentifier).fetchSockets();
      const clientUsers = socketsInRoom.map((s) => ({
        id: s.data.userId,
        name: s.data.username,
      }));

      io.in(roomIdentifier).emit("userList", clientUsers);

      // 7️⃣ Send join message ONLY if this is a new user
      if (isNewUser) {
        io.in(roomIdentifier).emit("chat-message", {
          username: "System",
          message: `${username} joined the room.`,
          ts: Date.now(),
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

      // 🔥 FIX: Broadcast to ALL users in the room (including sender for consistency)
      io.in(normalizedId).emit("video-action", { action, time, videoId });

      try {
        const update = {};

        switch (action) {
          case "play":
            update.isPlaying = true; // 🔥 Update DB state
            if (typeof time === "number") update.currentTime = time;
            break;

          case "pause":
            update.isPlaying = false; // 🔥 Update DB state
            if (typeof time === "number") update.currentTime = time;
            break;

          case "seek":
            if (typeof time === "number") update.currentTime = time;
            break;

          case "changeVideo":
            if (videoId) update.videoId = videoId;
            update.currentTime = 0;
            update.isPlaying = false; // 🔥 Ensure new video doesn't autoplay
            break;

          default:
            console.warn(`⚠️ Unknown video action: ${action}`);
            return;
        }

        if (Object.keys(update).length > 0) {
          // ✅ Combined update with lastActive
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
    io.in(normalizedId).emit("chat-message", {
      username,
      message,
      ts: Date.now(),
      userId: socket.data.userId,
    });
    await Room.findOneAndUpdate(
      { roomCode: normalizedId },
      { lastActive: Date.now() }
    );
  });

  // --- DISCONNECTING HANDLER ---
  socket.on("disconnecting", async () => {
    console.log(
      `🔌 User disconnecting: ${socket.id} (${socket.data.username})`
    );
    // Short delay to ensure room state is correct for fetchSockets
    await new Promise((resolve) => setTimeout(resolve, 50));

    const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    const disconnectingUser = socket.data.username;
    const userIdentifier = disconnectingUser || socket.data.userId;

    for (const roomIdentifier of rooms) {
      const normalizedId = normalizeRoomId(roomIdentifier);

      // 1. Get the room from DB
      const room = await Room.findOne({ roomCode: normalizedId });

      // 2. Handle HOST LEAVING (Room Deletion)
      if (room && room.hostName === disconnectingUser) {
        // Notify all users that the host left
        io.in(normalizedId).emit("roomDeleted", {
          message: "Room deleted because host (the creator) left.",
        });

        // Delete from DB
        await Room.deleteOne({ roomCode: normalizedId });
        console.log(
          `🗑️ Room ${normalizedId} deleted because host ${disconnectingUser} left.`
        );

        // Force all users to leave the socket room
        const socketsRemaining = await io.in(normalizedId).fetchSockets();
        for (const s of socketsRemaining) {
          s.leave(normalizedId);
          s.disconnect(true);
        }

        return;
      }

      // --- Handle REGULAR USER LEAVING ---

      // Remove the user from the room's users array in the DB
      if (userIdentifier) {
        await Room.findOneAndUpdate(
          { roomCode: normalizedId },
          { $pull: { users: userIdentifier } }
        );
        console.log(
          `👤 Removed user ${userIdentifier} from DB for room ${normalizedId}.`
        );
      }

      // 3. Get remaining sockets (after this user leaves)
      const socketsRemaining = await io.in(normalizedId).fetchSockets();
      const users = socketsRemaining
        .filter((s) => s.id !== socket.id)
        .map((s) => ({
          id: s.data.userId,
          name: s.data.username || "Anon",
        }));

      // 4. Update user list for remaining users
      io.in(normalizedId).emit("userList", users);

      // 5. Send leave chat message
      io.in(normalizedId).emit("chat-message", {
        username: "System",
        message: `${disconnectingUser} left the room.`,
        ts: Date.now(),
      });

      console.log(
        `Updated user list for room ${normalizedId}. Remaining: ${users.length}`
      );
    }
  });
  
});

// =========================================================================
// 5. DATABASE AND SERVER STARTUP
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
