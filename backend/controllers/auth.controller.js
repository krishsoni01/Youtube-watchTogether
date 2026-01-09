const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const generateUsername = require("../utils/generateUsername");

// --- HELPER FUNCTIONS ---
function isValidEmail(email) {
  const regex = /^\S+@\S+\.\S+$/;
  return regex.test(email);
}

const SignupController = async (req, res) => {
  try {
    let { username, email, password } = req.body;

    // Trim & normalize
    username = username?.trim();
    email = email?.trim().toLowerCase();
    password = password?.trim();

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Check for existing user
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Username or email already exists" });
    }

    // Hash password & save
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    // Generate token
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      username: newUser.username,
    });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const LoginController = async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();
    password = password?.trim();

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      username: user.username,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const googleAuthCallback = async (req, res) => {
  try {
    const user = req.user;

    const isUserExists = await User.findOne({
      $or: [{ email: user.emails[0].value }, { googleId: user.id }],
    });

    if (isUserExists) {
      const token = jwt.sign(
        { id: isUserExists._id, username: isUserExists.username },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.redirect(
        `https://watch-together-beta.vercel.app/?auth=success&token=${encodeURIComponent(
          token
        )}&username=${encodeURIComponent(isUserExists.username)}`
      );
    }

    const username = generateUsername(user);

    const newUser = new User({
      googleId: user.id,
      email: user.emails[0].value,
      username: username,
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.redirect(
      `https://watch-together-beta.vercel.app/?auth=success&token=${encodeURIComponent(
        token
      )}&username=${encodeURIComponent(newUser.username)}`
    );
  } catch (error) {
    console.error("Google auth error:", error);
    res.redirect(
      "https://watch-together-beta.vercel.app/login?error=auth_failed"
    );
  }
};

module.exports = {
  SignupController,
  LoginController,
  googleAuthCallback,
};
