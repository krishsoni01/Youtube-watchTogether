import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import CreationPage from "./components/CreationPage";
import WatchTogetherRoom from "./components/WatchTogetherRoom";
import LoginPage from "./components/LoginForm";
import RegisterPage from "./components/SignupForm";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- PRIVATE ROUTE WRAPPER ---
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
  const [isLoading, setIsLoading] = useState(true);

  // Handle OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    const token = params.get("token");
    const username = params.get("username");
    const error = params.get("error");

    if (error === "auth_failed") {
      toast.error("Authentication failed. Please try again.");
      // Clean URL
      window.history.replaceState({}, document.title, "/login");
      setIsLoading(false);
      return;
    }

    if (auth === "success" && token && username) {
      try {
        // Store credentials FIRST
        localStorage.setItem("token", decodeURIComponent(token));
        localStorage.setItem("username", decodeURIComponent(username));

        toast.success(`Welcome, ${decodeURIComponent(username)}!`);

        // Clean URL - use replace instead of replaceState
        window.history.replaceState({}, document.title, "/");

        // Small delay to ensure localStorage is set before rendering
        setTimeout(() => {
          setIsLoading(false);
        }, 100);
      } catch (err) {
        console.error("Error storing auth data:", err);
        toast.error("Failed to save authentication data");
        setIsLoading(false);
      }
      return;
    }

    // No auth params, proceed normally
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 mx-auto mb-4"
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
          <p>Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        // theme="dark"
        style={{
          top: "10px",
          zIndex: 9999,
        }}
        toastStyle={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: "14px",
          padding: "12px",
          borderRadius: "8px",
          maxWidth: "90vw",
          margin: "0 auto",
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <CreationPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <PrivateRoute>
              <WatchTogetherRoom />
            </PrivateRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
