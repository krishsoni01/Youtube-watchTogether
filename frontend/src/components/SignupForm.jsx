import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

const SignupForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }

    try {
      const res = await axios.post(
        "https://youtube-watchtogether.onrender.com/api/auth/signup",
        {
          username: formData.username.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("username", res.data.username);
      setMessage("Signup successful! Redirecting...");
      navigate("/");
    } catch (err) {
      console.error("Signup error:", err.response || err);
      setMessage(err.response?.data?.message || "Error occurred");
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-start sm:justify-center bg-black text-white px-4 pt-10 sm:pt-0 overflow-hidden">
      {/* Signup Card */}
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-lg p-8">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm-6 9a6 6 0 0112 0H6z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white">
            Create an Account
          </h2>
          <p className="text-gray-400 mb-6 mx-auto text-center">
            Join the watch party and enjoy together 🎥
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="username"
            placeholder="Username"
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <span
              className="absolute right-3 top-3 cursor-pointer text-gray-400 hover:text-pink-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm Password"
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <span
              className="absolute right-3 top-3 cursor-pointer text-gray-400 hover:text-pink-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg font-semibold bg-pink-600 hover:bg-pink-500 text-white transition"
          >
            Signup
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-gray-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-pink-400 font-semibold hover:underline"
          >
            Login
          </Link>
        </p>

        {message && (
          <p className="text-center text-red-400 mt-3 text-sm">{message}</p>
        )}
      </div>
    </div>
  );
};

export default SignupForm;

