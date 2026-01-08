import { Routes, Route, Navigate } from "react-router-dom";
import CreationPage from "./components/CreationPage";
import WatchTogetherRoom from "./components/WatchTogetherRoom";
import LoginPage from "./components/LoginForm";
import RegisterPage from "./components/SignupForm";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- PRIVATE ROUTE WRAPPER ---
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};

function App() {
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
      return;
    }

    if (auth === "success" && token && username) {
      // Store credentials
      localStorage.setItem("token", token);
      localStorage.setItem("username", decodeURIComponent(username));

      toast.success(`Welcome, ${decodeURIComponent(username)}!`);

      // Clean URL and redirect to home
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

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
      <OAuthHandler />
    </>
  );
}

export default App;
