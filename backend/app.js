const express = require("express");
const cors = require("cors");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const roomRoutes = require("./routes/room");

// Try loading auth routes safely
let authRoutes;
try {
  authRoutes = require("./routes/auth");
} catch (err) {
  console.warn("⚠️ Auth routes not found or invalid. Skipping /api/auth.");
}

// =========================================================================
// EXPRESS APP CONFIGURATION
// =========================================================================
const app = express();

// CORS Configuration
const corsOptions = {
  origin: ["http://localhost:5173", "https://watch-together-beta.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// =========================================================================
// GOOGLE AUTHENTICATION STRATEGY
// =========================================================================
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

// =========================================================================
// ROUTES
// =========================================================================

// Default route
app.get("/", (req, res) => {
  res.send("Watch Together Server is Running");
});

// Auth routes
if (authRoutes) {
  app.use("/api/auth", authRoutes);
}

// =========================================================================
// EXPORT APP AND SETUP FUNCTION
// =========================================================================

// Function to setup routes that need io instance
const setupAppRoutes = (io) => {
  const { setIO } = require("./controllers/room.controller");
  setIO(io); // Pass io instance to room controller
  app.use("/api/rooms", roomRoutes(io));
};

module.exports = { app, setupAppRoutes, corsOptions };
