import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

const LoginForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

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
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Wait a bit for cookies to be set
      await new Promise((resolve) => setTimeout(resolve, 500));

      navigate("/");
    } catch (err) {
      console.error("Login error:", err.response || err);
      // 🔔 Vibrate on error (mobile only)
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      setMessage(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (navigator.vibrate) navigator.vibrate(40);
    setGoogleLoading(true);
    window.location.href =
      "https://youtube-watchtogether.onrender.com/api/auth/google";
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

          <button
            type="submit"
            disabled={loading}
            onClick={() => navigator.vibrate && navigator.vibrate(40)}
            className="w-full py-3 rounded-lg font-semibold bg-pink-600 hover:bg-pink-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
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
          </button>
          {/* //google button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-3 rounded-lg font-semibold bg-white hover:bg-gray-100 text-gray-700 transition flex items-center justify-center gap-2 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {googleLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                Connecting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>
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
