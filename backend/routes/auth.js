const express = require("express");
const {
  SignupController,
  LoginController,
  googleAuthCallback,
} = require("../controllers/auth.controller");
const passport = require("passport");
const router = express.Router();

// --- SIGNUP ---
router.post("/signup", SignupController);

// --- LOGIN ---
router.post("/login", LoginController);

// Route to initiate Google OAuth flow
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback route that Google will redirect to after authentication
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleAuthCallback
);

// Wake-up route to keep the server alive
router.get("/wake-up", (req, res) => {
  res.status(200).json({ status: "awake" });
});

module.exports = router;
