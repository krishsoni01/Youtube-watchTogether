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

module.exports = router;
