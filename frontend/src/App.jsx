import { Routes, Route, Navigate } from "react-router-dom";
import CreationPage from "./components/CreationPage";
import WatchTogetherRoom from "./components/WatchTogetherRoom";
import LoginPage from "./components/LoginForm"; // <-- assume you have login
import RegisterPage from "./components/SignupForm"; // <-- assume register
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- PRIVATE ROUTE WRAPPER ---
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem("token"); // or read from cookies
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <>
      <ToastContainer position="top-right" autoClose={2500} />
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
