const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const generateUsername = require("../utils/generateUsername");

// --- HELPER FUNCTIONS ---
function isValidEmail(email) {
  const regex = /^\S+@\S+\.\S+$/;
  return regex.test(email);
}

const getCookieOptions = () => ({
  httpOnly: true,
  secure: true, // true in production
  sameSite: "none", // for cross-origin
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
  domain: "https://watch-together-beta.vercel.app",
});

const getUsernameCookieOptions = () => ({
  httpOnly: false,
  secure: true,
  sameSite: "none", // for cross-origin
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
  domain: "https://watch-together-beta.vercel.app",
});

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

    res.cookie("token", token, getCookieOptions());
    res.cookie("username", newUser.username, getUsernameCookieOptions());

    res.status(201).json({
      message: "User created successfully",
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

    res.cookie("token", token, getCookieOptions());
    res.cookie("username", user.username, getUsernameCookieOptions());

    res
      .status(200)
      .json({ message: "Login successful", username: user.username });
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

      res.cookie("token", token, getCookieOptions());
      res.cookie("username", isUserExists.username, getUsernameCookieOptions());
      
      return res.redirect("https://watch-together-beta.vercel.app/?auth=success");
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

    res.cookie("token", token, getCookieOptions());
    res.cookie("username", newUser.username, getUsernameCookieOptions());
    res.redirect("https://watch-together-beta.vercel.app/?auth=success");
  } catch (error) {
    console.error("Google auth error:", error);
    res.redirect("https://watch-together-beta.vercel.app/login?error=auth_failed");
  }
};

const verifyTokenController = (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ authenticated: true, user: decoded });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ authenticated: false });
  }
};

const clearCookies = (req, res) => {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    };

    const usernameCookieOptions = {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/',
    };

    res.clearCookie("token", cookieOptions);
    res.clearCookie("username", usernameCookieOptions);

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed" });
  }
};

module.exports = {
  SignupController,
  LoginController,
  googleAuthCallback,
  verifyTokenController,
  clearCookies,
};
