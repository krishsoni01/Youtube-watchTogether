require("dotenv").config();
const http = require("http");
const socketIo = require("socket.io");
const { app, setupAppRoutes, corsOptions } = require("./app");
const connectDB = require("./db/db");
const { cleanupInactiveRooms } = require("./utils/cleanupInactiveRooms");
const setupSocketHandlers = require("./utils/socket");

// =========================================================================
// SERVER INITIALIZATION
// =========================================================================
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions,
});

// =========================================================================
// SETUP APP ROUTES WITH IO INSTANCE
// =========================================================================
setupAppRoutes(io);

// =========================================================================
// AUTO-CLEANUP: DELETE INACTIVE ROOMS (> 1 HOUR)
// =========================================================================

// Run cleanup on server start
cleanupInactiveRooms(io);
// Run cleanup every 30 minutes
setInterval(() => cleanupInactiveRooms(io), 30 * 60 * 1000);

// =========================================================================
// SOCKET.IO CONNECTION LISTENER
// =========================================================================
setupSocketHandlers(io);

// =========================================================================
// DATABASE AND SERVER STARTUP
// =========================================================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("❌ Server Startup Error:", err);
    process.exit(1);
  }
};

startServer();
