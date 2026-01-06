import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import CreationPage from "./components/CreationPage";
import WatchTogetherRoom from "./components/WatchTogetherRoom";
import LoginPage from "./components/LoginForm"; // <-- assume you have login
import RegisterPage from "./components/SignupForm"; // <-- assume register
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- PRIVATE ROUTE WRAPPER ---
const PrivateRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = searchParams.get("auth");
        if (authStatus === "success") {
          // Wait a bit for cookies to be set
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        const response = await fetch(
          "https://youtube-watchtogether.onrender.com/api/verify-auth",
          {
            method: "GET",
            credentials: "include",
          }
        );
        setIsAuthenticated(response.ok);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return <div>Loading...</div>; // or a spinner
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
