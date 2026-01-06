import { Routes, Route, Navigate } from "react-router-dom";
import CreationPage from "./components/CreationPage";
import WatchTogetherRoom from "./components/WatchTogetherRoom";
import LoginPage from "./components/LoginForm"; // <-- assume you have login
import RegisterPage from "./components/SignupForm"; // <-- assume register
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Cookies from 'js-cookie';

// --- PRIVATE ROUTE WRAPPER ---
const PrivateRoute = ({ children }) => {
  const token = Cookies.get("token"); // or read from cookies
  return token ? children : <Navigate to="/login" replace />;
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
