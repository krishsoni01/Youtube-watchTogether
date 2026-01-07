import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import CreationPage from "./components/CreationPage";
import WatchTogetherRoom from "./components/WatchTogetherRoom";
import LoginPage from "./components/LoginForm";
import RegisterPage from "./components/SignupForm";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- PRIVATE ROUTE WRAPPER ---
const PrivateRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [searchParams] = useSearchParams();

  // useEffect(() => {
  //   const checkAuth = async () => {
  //     try {
  //       const authStatus = searchParams.get("auth");

  //       if (authStatus === "success") {
  //         await new Promise((resolve) => setTimeout(resolve, 500));
  //       }

  //       const response = await fetch(
  //         "https://youtube-watchtogether.onrender.com/api/verify-auth",
  //         {
  //           method: "GET",
  //           credentials: "include", // This is crucial
  //         }
  //       );

  //       if (response.ok) {
  //         setIsAuthenticated(true);
  //         // Clean up URL if auth=success is present
  //         if (authStatus === "success") {
  //           window.history.replaceState({}, "", "/");
  //         }
  //       } else {
  //         setIsAuthenticated(false);
  //       }
  //     } catch (error) {
  //       console.error("Auth check error:", error);
  //       setIsAuthenticated(false);
  //     }
  //   };

  //   checkAuth();
  // }, [searchParams]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = searchParams.get("auth");

        // If auth=success, wait a bit for cookies to be set
        if (authStatus === "success") {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const response = await fetch(
          "https://youtube-watchtogether.onrender.com/api/verify-auth",
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            // Clean up URL after successful auth
            if (authStatus === "success") {
              window.history.replaceState({}, "", "/");
            }
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, [searchParams]);

  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-6">
          {/* Multi-ring Spinner */}
          <div className="relative w-20 h-20">
            {/* Outer ring */}
            <div className="absolute inset-0 border-4 border-pink-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-pink-500 rounded-full animate-spin"></div>

            {/* Middle ring */}
            <div className="absolute inset-2 border-4 border-purple-500/20 rounded-full"></div>
            <div
              className="absolute inset-2 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"
              style={{ animationDuration: "1.5s" }}
            ></div>

            {/* Inner ring */}
            <div className="absolute inset-4 border-4 border-indigo-500/20 rounded-full"></div>
            <div
              className="absolute inset-4 border-4 border-transparent border-t-indigo-500 rounded-full animate-spin"
              style={{ animationDuration: "2s" }}
            ></div>
          </div>

          {/* Text with dots animation */}
          <p className="text-lg text-pink-400 font-medium">
            Verifying authentication<span className="animate-pulse">...</span>
          </p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
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
