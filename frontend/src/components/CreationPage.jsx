import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { Settings, X, CornerUpLeft, LogOut } from "lucide-react";

// ===============================================
// Utilities
// ===============================================
const firebaseConfig =
  typeof __firebase_config !== "undefined" ? JSON.parse(__firebase_config) : {};
const initialAuthToken =
  typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const generateRoomId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
};

// ===============================================
// Join Room View
// ===============================================

// const JoinRoomView = ({ onScreenChange, username }) => {
//   const [roomCode, setRoomCode] = useState("");
//   const navigate = useNavigate();

//   const handleJoin = () => {
//     if (roomCode.trim().length === 6) {
//       navigate(`/room/${roomCode}`);
//     }
//   };

//   const handleChange = (e) => {
//     // Allow only letters and numbers (A-Z, 0-9) and limit to 6 characters
//     const value = e.target.value
//       .toUpperCase()
//       .replace(/[^A-Z0-9]/g, "")
//       .slice(0, 6);
//     setRoomCode(value);
//   };

//   const handleKeyDown = (e) => {
//     if (e.key === "Enter" && roomCode.length === 6) {
//       handleJoin();
//     }
//   };

//   return (
//     <div className="flex flex-col items-center justify-between min-h-screen w-full max-w-md mx-auto pb-8">
//       {/* Header */}
//       <header className="sticky top-0 w-full flex items-center gap-2 pt-6 pb-4 px-6 bg-black text-white border-b border-gray-600">
//         <button
//           onClick={() => onScreenChange("home")}
//           className="flex items-center gap-2 text-gray-400 hover:text-pink-400 transition"
//         >
//           <CornerUpLeft size={20} />
//           <span className="font-medium">Back</span>
//         </button>
//       </header>

//       {/* Hero Illustration */}
//       <div className="flex flex-col items-center mt-20 text-center px-6">
//         <div className="w-40 h-40 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
//           <svg
//             xmlns="http://www.w3.org/2000/svg"
//             className="w-16 h-16 text-white"
//             viewBox="0 0 24 24"
//             fill="currentColor"
//           >
//             <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM11 16v-4H8l4-5v4h3l-4 5z" />
//           </svg>
//         </div>
//         <p className="mt-6 text-gray-400 max-w-xs">
//           Enter your friend’s room code below and jump into the watch party 🍿
//         </p>
//       </div>

//       {/* Input + Actions */}
//       <div className="w-full flex flex-col items-center px-6 mt-10">
//         <input
//           type="text"
//           value={roomCode}
//           onChange={handleChange}
//           onKeyDown={handleKeyDown}
//           placeholder="Enter 6-character room code"
//           className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center tracking-widest text-lg"
//         />
//         <button
//           onClick={handleJoin}
//           disabled={roomCode.length !== 6}
//           className="w-full mt-4 py-3 rounded-lg font-semibold bg-pink-600 hover:bg-pink-500 text-white transition disabled:opacity-50"
//         >
//           Join Room
//         </button>
//       </div>
//     </div>
//   );
// };

const JoinRoomView = ({ onScreenChange, username }) => {
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async () => {
    if (roomCode.trim().length !== 6) return;
    setError("");
    setLoading(true);

    try {
      // Check if room exists in DB
      const res = await axios.get(
        `http://localhost:5000/api/rooms/${roomCode}`
      );
      if (res.data) {
        // Room exists → join
        navigate(`/room/${roomCode}`);
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError("❌ Room not found. Please check the code and try again.");
      } else {
        setError("⚠️ Something went wrong. Try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    setRoomCode(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && roomCode.length === 6) {
      handleJoin();
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen w-full max-w-md mx-auto pb-8">
      {/* Header */}
      <header className="sticky top-0 w-full flex items-center gap-2 pt-6 pb-4 px-6 bg-black text-white border-b border-gray-600">
        <button
          onClick={() => onScreenChange("home")}
          className="flex items-center gap-2 text-gray-400 hover:text-pink-400 transition"
        >
          <CornerUpLeft size={20} />
          <span className="font-medium">Back</span>
        </button>
      </header>

      {/* Hero Illustration */}
      <div className="flex flex-col items-center mt-20 text-center px-6">
        <div className="w-40 h-40 bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-16 h-16 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM11 16v-4H8l4-5v4h3l-4 5z" />
          </svg>
        </div>
        <p className="mt-6 text-gray-400 max-w-xs">
          Enter your friend’s room code below and jump into the watch party 🍿
        </p>
      </div>

      {/* Input + Actions */}
      <div className="w-full flex flex-col items-center px-6 mt-10">
        <input
          type="text"
          value={roomCode}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter 6-character room code"
          className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-center tracking-widest text-lg"
        />

        {error && (
          <p className="text-red-500 text-sm mt-3 text-center">{error}</p>
        )}

        <button
          onClick={handleJoin}
          disabled={roomCode.length !== 6 || loading}
          className="w-full mt-4 py-3 rounded-lg font-semibold bg-pink-600 hover:bg-pink-500 text-white transition disabled:opacity-50"
        >
          {loading ? "Checking..." : "Join Room"}
        </button>
      </div>
    </div>
  );
};

// ===============================================
// Home View
// ===============================================

const HomeView = ({ onScreenChange, userId, username }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [copied, setCopied] = useState(false); // <-- track copy state
  const navigate = useNavigate();
  const greeting = getGreeting();

  const handleLogout = () => {
    localStorage.clear(); // 👈 remove all credentials
    navigate("/login");
  };

  const handleCreateRoom = useCallback(async () => {
    if (!userId) return;
    const newRoomId = generateRoomId();

    try {
      // Save room in MongoDB
      await axios.post("http://localhost:5000/api/rooms", {
        roomCode: newRoomId,
        hostName: username,
        users: [username],
      });

      setRoomId(newRoomId);
      setShowPopup(true);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  }, [userId, username]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowPopup(false);
      navigate(`/room/${roomId}`);
    }, 2000); // wait 2 seconds before redirect
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto min-h-screen pb-8">
      {/* Header */}
      {/* <header className="sticky top-0 w-full flex justify-between items-center pt-6 pb-4 px-6 bg-black text-white border-b border-gray-600">
        <h1 className="text-3xl font-bold">{greeting}</h1>
        <Settings size={24} className="text-gray-400" />
      </header> */}
      <header className="sticky top-0 w-full flex justify-between items-center pt-6 pb-4 px-6 bg-black text-white border-b border-gray-600 relative">
        <h1 className="text-3xl font-bold">{greeting}</h1>

        {/* Settings Icon */}
        <div className="relative">
          <Settings
            size={24}
            className="text-gray-400 cursor-pointer hover:text-pink-400 transition"
            onClick={() => setShowSettings(!showSettings)}
          />

          {/* Dropdown menu */}
          {showSettings && (
            <div className="absolute right-0 mt-2 w-40 bg-gray-900 rounded-lg shadow-lg border border-gray-700">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-pink-400 rounded-lg transition"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Illustration */}
      <div className="flex flex-col items-center mt-20 text-center px-6">
        <div className="w-40 h-40 bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-16 h-16 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" /> {/* play icon */}
          </svg>
        </div>
        <p className="mt-6 text-gray-400 max-w-xs">
          Create a room, share the code, and enjoy watching videos together in
          real-time 🎬
        </p>
      </div>

      {/* Actions */}
      <div className="w-full flex space-x-2 mt-10 px-6">
        <button
          onClick={handleCreateRoom}
          disabled={!userId}
          className="flex-1 py-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-200"
        >
          New room
        </button>
        <button
          onClick={() => onScreenChange("join")}
          disabled={!userId}
          className="flex-1 py-3 rounded-lg font-semibold text-white bg-gray-800 hover:bg-gray-700"
        >
          Join with a code
        </button>
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
          <div className="bg-gray-900 p-6 rounded-xl shadow-lg text-center w-80">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white">Room Created!</h2>
              <button
                onClick={() => {
                  setShowPopup(false);
                }}
                className="text-gray-400 hover:text-pink-400"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-300 mb-2">Share this code:</p>
            <p className="text-2xl font-mono font-bold text-pink-400 mb-4 bg-white py-2 rounded-lg">
              {roomId}
            </p>
            <div className="flex space-x-2 justify-center">
              <button
                onClick={copyCode}
                disabled={copied}
                className={`px-4 py-2 rounded-lg text-white font-semibold transition ${
                  copied
                    ? "bg-green-600 cursor-default"
                    : "bg-gray-800 hover:bg-gray-700"
                }`}
              >
                {copied ? "Copied" : "Copy Code"}
              </button>
              <button
                onClick={() => {
                  setShowPopup(false);
                  navigate(`/room/${roomId}`);
                }}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-white font-semibold"
              >
                Go to Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===============================================
// Main CreationPage
// ===============================================
const CreationPage = () => {
  const [screen, setScreen] = useState("home");
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [username, setUsername] = useState(null);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    let authInstance;

    if (firebaseConfig?.projectId) {
      const app = initializeApp(firebaseConfig);
      getFirestore(app);
      authInstance = getAuth(app);
    }

    const handleAuth = async () => {
      if (authInstance) {
        unsubscribe = onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            try {
              const cred = initialAuthToken
                ? await signInWithCustomToken(authInstance, initialAuthToken)
                : await signInAnonymously(authInstance);
              setUserId(cred.user.uid);
            } catch {
              setUserId(crypto.randomUUID());
            }
          }
          setIsAuthReady(true);
        });
      } else {
        setUserId(crypto.randomUUID());
        setIsAuthReady(true);
      }
    };

    handleAuth();
    return () => unsubscribe();
  }, []);

  if (!isAuthReady || !userId) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p className="text-lg text-pink-400">Loading Application...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {screen === "home" && (
        <HomeView
          onScreenChange={setScreen}
          userId={userId}
          username={username}
        />
      )}
      {screen === "join" && (
        <JoinRoomView
          onScreenChange={setScreen}
          userId={userId}
          username={username}
        />
      )}
      <div className="fixed bottom-0 w-full text-center text-xs bg-gray-900 text-gray-400 py-1">
        Current User ID: {userId}
      </div>
    </div>
  );
};

export default CreationPage;
