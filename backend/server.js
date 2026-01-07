const dotenv = require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const roomRoutes = require("./routes/room");
const cors = require("cors");
const { cleanupInactiveRooms } = require("./utils/cleanupInactiveRooms");
const setupSocketHandlers = require("./utils/socket");
const connectDB = require("./db/db");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const cookieParser = require("cookie-parser");
const { verifyTokenController , clearCookies } = require("./controllers/auth.controller");

// Try loading auth routes safely
let authRoutes;
try {
  authRoutes = require("./routes/auth");
} catch (err) {
  console.warn("⚠️ Auth routes not found or invalid. Skipping /api/auth.");
}

// =========================================================================
// 2. INITIALIZATION
// =========================================================================
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://watch-together-beta.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://watch-together-beta.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(cookieParser());
app.use(express.json());

// GOOGLE AUTHENTICATION
// Configure Passport to use Google OAuth 2.0 strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      // Here, you would typically find or create a user in your database
      // For this example, we'll just return the profile
      return done(null, profile);
    }
  )
);

// Default route
app.get("/", (req, res) => {
  res.send("Watch Together Server is Running");
});
// Create a verification endpoint
app.get("/api/verify-auth", verifyTokenController);
// Clear cookies
app.get("/api/logout" , clearCookies)
// AUTH ROUTES
if (authRoutes) {
  app.use("/api/auth", authRoutes);
}
// app.use("/api/rooms", roomRoutes);
app.use("/api/rooms", roomRoutes(io));

// =========================================================================
// 4. AUTO-CLEANUP: DELETE INACTIVE ROOMS (> 1 HOUR)
// =========================================================================
// Run cleanup on server start
cleanupInactiveRooms(io);
// Run cleanup every 10 minutes
setInterval(() => cleanupInactiveRooms(io), 30 * 60 * 1000);

// =========================================================================
// 5. SOCKET.IO CONNECTION LISTENER
// =========================================================================
setupSocketHandlers(io);

// =========================================================================
// 6. DATABASE AND SERVER STARTUP
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
