import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import GoogleLoginButton from "./GoogleLoginButton";

const LoginForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // Progress animation when loading
  useEffect(() => {
    let progressInterval;
    if (loading) {
      setProgress(0);
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 95; // Cap at 95% until actual success
          return prev + 2;
        });
      }, 100); // Smooth increment every 100ms
    } else {
      setProgress(0);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = formData.email.trim().toLowerCase();
    const password = formData.password.trim();

    if (!email || !password) {
      setMessage("Email and password are required");
      if (navigator.vibrate) navigator.vibrate(200);
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post(
        "https://youtube-watchtogether.onrender.com/api/auth/login",
        {
          email,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      setProgress(100);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("username", res.data.username);

      // Small delay to show completion
      setTimeout(() => {
        navigate("/");
      }, 300);
    } catch (err) {
      console.error("Login error:", err.response || err);
      // 🔔 Vibrate on error (mobile only)
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      setMessage(err.response?.data?.message || "Login failed");
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 300);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-start sm:justify-center bg-black text-white px-4 pt-10 sm:pt-0 overflow-hidden">
      {/* Login Card */}
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
          <h2 className="text-2xl font-bold mb-2 text-white">Welcome Back</h2>
          <p className="text-gray-400 mb-6 mx-auto text-center">
            Login to continue your watch party 🎬
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              onClick={() => {
                setShowPassword(!showPassword);
                if (navigator.vibrate) navigator.vibrate(40);
              }}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </div>

          <div className="w-full">
            <button
              type="submit"
              disabled={loading}
              onClick={() => navigator.vibrate && navigator.vibrate(40)}
              className="w-full py-3 rounded-lg font-semibold bg-pink-600 hover:bg-pink-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center relative overflow-hidden"
            >
              {/* Progress Bar Background */}
              {loading && (
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 transition-all duration-100 ease-out opacity-40"
                  style={{ width: `${progress}%` }}
                />
              )}

              {/* Button Content */}
              <div className="relative z-10 flex items-center">
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 mr-2"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </div>
            </button>

            {/* Progress Indicator */}
            {loading && (
              <div className="mt-2 text-center">
                <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                  <div className="flex gap-1">
                    <div
                      className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            )}
          </div>
          {/* // Google Login Button */}
          <GoogleLoginButton />
        </form>

        <p
          onClick={() => navigator.vibrate && navigator.vibrate(40)}
          className="text-sm text-center mt-4 text-gray-400"
        >
          Don’t have an account?{" "}
          <Link
            to="/register"
            className="text-pink-400 font-semibold hover:underline"
          >
            Signup
          </Link>
        </p>

        {message && (
          <p className="text-center text-red-400 mt-3 text-sm">{message}</p>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
