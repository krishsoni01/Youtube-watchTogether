import { useRef, useState, useEffect, useCallback } from "react";
import React from "react";
import io from "socket.io-client";
import {
  Play,
  Pause,
  Maximize,
  Minimize,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  LogOut,
  Copy,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

const YOUTUBE_API_SCRIPT_URL = "https://www.youtube.com/iframe_api";
const SOCKET_SERVER_URL = "https://youtube-watchtogether.onrender.com";
const YT_DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";

const requestFullscreen = (element) => {
  if (element.requestFullscreen) element.requestFullscreen();
  else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
  else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
  else if (element.msRequestFullscreen) element.msRequestFullscreen();
};

const exitFullscreen = () => {
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  else if (document.msExitFullscreen) document.msExitFullscreen();
};

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const WatchTogetherRoom = ({ username = "guest" }) => {
  const { roomId: paramRoomId } = useParams();
  const navigate = useNavigate();
  const roomId = paramRoomId || "demo-room";

  const [hostName, setHostName] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoId, setVideoId] = useState(YT_DEFAULT_VIDEO_ID);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [users, setUsers] = useState([]);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [videoError, setVideoError] = useState("");
  const localUsername = localStorage.getItem("username") || username;

  // --- REFS ---
  const socketRef = useRef(null);
  const playerRef = useRef(null);
  const playerDivRef = useRef(null);
  const videoContainerRef = useRef(null);
  const chatEndRef = useRef(null);
  const controlsHideTimeoutRef = useRef(null);
  const isRemoteActionRef = useRef(false);
  const previousUserIdsRef = useRef(new Set());
  const pendingVideoIdRef = useRef(null); // NEW: Track pending video changes
  // Add this with your other refs
  const previousVideoIdRef = useRef(videoId);

  // 🔥 FIX: Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // --- Effects & Callbacks ---

  useEffect(() => {
    const exitHandler = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;

      if (isFullscreen && !isCurrentlyFullscreen) {
        console.log("Exited fullscreen via native event (e.g., Esc key).");
        setIsFullscreen(false);

        // Unlock orientation when exiting fullscreen
        try {
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
        } catch (err) {
          console.log("Screen orientation unlock failed");
        }
      } else if (!isFullscreen && isCurrentlyFullscreen) {
        console.log("Entered fullscreen via native event.");
        setIsFullscreen(true);

        // Lock to landscape when entering fullscreen
        try {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch((err) => {
              console.log("Orientation lock failed:", err);
            });
          }
        } catch (err) {
          console.log("Screen orientation API not available");
        }
      }
    };

    document.addEventListener("fullscreenchange", exitHandler, false);
    document.addEventListener("webkitfullscreenchange", exitHandler, false);
    document.addEventListener("mozfullscreenchange", exitHandler, false);
    document.addEventListener("MSFullscreenChange", exitHandler, false);

    return () => {
      document.removeEventListener("fullscreenchange", exitHandler);
      document.removeEventListener("webkitfullscreenchange", exitHandler);
      document.removeEventListener("mozfullscreenchange", exitHandler);
      document.removeEventListener("MSFullscreenChange", exitHandler);
    };
  }, [isFullscreen]);

  const resetControlsTimer = useCallback(() => {
    if (controlsHideTimeoutRef.current)
      clearTimeout(controlsHideTimeoutRef.current);
    if (isPlaying && isFullscreen && !isSeeking) {
      controlsHideTimeoutRef.current = setTimeout(
        () => setIsControlsVisible(false),
        3000
      );
    }
  }, [isPlaying, isFullscreen, isSeeking]);

  const initializePlayer = useCallback(() => {
    if (window.YT && window.YT.Player && playerDivRef.current) {
      if (playerRef.current?.destroy) playerRef.current.destroy();

      playerRef.current = new window.YT.Player(playerDivRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin,
          enablejsapi: 1,
          widget_referrer: window.location.origin,
        },
        events: {
          onReady: (event) => {
            console.log("Player ready");
            setIsPlayerReady(true);
            const duration = event.target.getDuration();
            setDuration(duration);

            // 🔥 FIX: Just cue the current video without autoplay
            event.target.cueVideoById({
              videoId: videoId,
              startSeconds: 0,
            });
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              const duration = event.target.getDuration();
              setDuration(duration);

              // Broadcast play action when video is played via YouTube controls
              if (!isRemoteActionRef.current && socketRef.current) {
                const currentTime = event.target.getCurrentTime();
                socketRef.current.emit("video-action", {
                  roomId,
                  action: "play",
                  time: currentTime,
                });
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);

              // Broadcast pause action when video is paused via YouTube controls
              if (!isRemoteActionRef.current && socketRef.current) {
                const currentTime = event.target.getCurrentTime();
                socketRef.current.emit("video-action", {
                  roomId,
                  action: "pause",
                  time: currentTime,
                });
              }
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
            }
          },
          onError: (e) => {
            console.error("YouTube Error:", e.data);

            const errorCode = e.data;

            let message = "An unknown error occurred.";

            if (errorCode === 100) {
              message = "Invalid video link. Please enter a valid YouTube URL.";
            } else if (errorCode === 101 || errorCode === 150) {
              message =
                "This video cannot be played due to owner restrictions.";
            }

            setVideoError(message);
            alert(message);
          },
        },
      });
    } else {
      window.onYouTubeIframeAPIReady = () => initializePlayer();
    }
  }, [videoId]);

  useEffect(() => {
    const fetchHostName = async () => {
      try {
        const response = await fetch(
          `https://youtube-watchtogether.onrender.com/api/rooms/${roomId}`
        );
        if (!response.ok) throw new Error("Failed to fetch room details");
        const data = await response.json();
        setHostName(data.hostName);
      } catch (error) {
        console.error("Error fetching host name:", error);
      }
    };
    fetchHostName();
  }, [roomId]);

  useEffect(() => {
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        initializePlayer();
      } else {
        window.onYouTubeIframeAPIReady = () => initializePlayer();
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      }
    };
    loadYouTubeAPI();
  }, [initializePlayer]);

  // 🔥 FIX: Improved video change handling
  useEffect(() => {
    // Only cue if video actually changed
    if (previousVideoIdRef.current === videoId) {
      return;
    }
    previousVideoIdRef.current = videoId;

    if (playerRef.current && isPlayerReady) {
      console.log("Changing video to:", videoId);
      // Small delay to ensure player is stable
      setTimeout(() => {
        playerRef.current.cueVideoById({
          videoId: videoId,
          startSeconds: 0,
        });
        setIsPlaying(false);
      }, 100);
    } else {
      pendingVideoIdRef.current = videoId;
    }
  }, [videoId, isPlayerReady]);

  // Time update interval
  useEffect(() => {
    let intervalId;
    if (isPlayerReady && !isSeeking) {
      intervalId = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 500);
    }
    return () => clearInterval(intervalId);
  }, [isPlayerReady, isSeeking]);

  // Fetch Users List
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(
          `https://youtube-watchtogether.onrender.com/api/rooms/${roomId}/users`
        );
        if (!response.ok) throw new Error("Failed to fetch users");
        const data = await response.json();
        setUsers(data.users || []);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, [roomId]);

  // SOCKETS connection and listeners
  useEffect(() => {
    const userId = Math.random().toString(36).slice(2, 10);
    const socket = io(SOCKET_SERVER_URL, {
      query: { userId, roomId, username: localUsername },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinRoom", { roomId, username: localUsername });
    });

    socket.on("roomJoined", (data) => {
      // Load previous messages
      if (data.previousMessages && data.previousMessages.length > 0) {
        setMessages(
          data.previousMessages.map((msg) => ({
            username: msg.username,
            message: msg.message,
            userId: msg.userId,
          }))
        );
      }

      if (data.videoId && data.videoId !== videoId) {
        setVideoId(data.videoId);
      }

      // Wait for player to be ready before syncing
      const syncPlayer = () => {
        if (playerRef.current && isPlayerReady) {
          // Cue the video first
          playerRef.current.cueVideoById({
            videoId: data.videoId || videoId,
            startSeconds: data.currentTime || 0,
          });

          // Then sync play state after a short delay
          setTimeout(() => {
            if (data.isPlaying) {
              playerRef.current.playVideo();
              setIsPlaying(true);
            } else {
              playerRef.current.pauseVideo();
              setIsPlaying(false);
            }
          }, 300);
        }
      };

      // If player is ready, sync immediately. Otherwise, wait
      if (isPlayerReady) {
        setTimeout(syncPlayer, 500);
      } else {
        setTimeout(syncPlayer, 1500);
      }

      if (data?.users) {
        setUsers(data.users);
        data.users.forEach((u) => previousUserIdsRef.current.add(u.id));
      }
    });

    socket.on("video-action", ({ action, time, videoId }) => {
      if (!playerRef.current) return;
      const player = playerRef.current;

      isRemoteActionRef.current = true;

      switch (action) {
        case "play":
          if (time !== undefined) {
            player.seekTo(time, true);
            setCurrentTime(time);
          }
          setTimeout(() => {
            player.playVideo();
            setIsPlaying(true);
          }, 100);
          break;
        case "pause":
          player.pauseVideo();
          setIsPlaying(false);
          if (time !== undefined) {
            player.seekTo(time, true);
            setCurrentTime(time);
          }
          break;
        case "seek":
          player.seekTo(time || 0, true);
          setCurrentTime(time || 0);
          break;
        case "changeVideo":
          if (videoId) {
            setVideoId(videoId);
            // Immediately cue the video to show thumbnail
            player.cueVideoById({
              videoId: videoId,
              startSeconds: 0,
            });
          }
          setIsPlaying(false);
          break;
      }
      setTimeout(() => {
        isRemoteActionRef.current = false;
      }, 1000);
    });

    socket.on("chat-message", (msg) => {
      if (msg.username !== localUsername || msg.username === "System") {
        setMessages((prev) => [
          ...prev,
          { username: msg.username, message: msg.message },
        ]);
      }
    });

    socket.on("userList", (userArray) => {
      setUsers(userArray);
    });

    socket.on("roomDeleted", (data) => {
      toast.info(data.message || "The room has been deleted.");
      navigate("/");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, localUsername, navigate, isPlayerReady]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isFullscreen) {
      setIsControlsVisible(true);
      if (controlsHideTimeoutRef.current)
        clearTimeout(controlsHideTimeoutRef.current);
      return;
    }

    const hideControls = () => setIsControlsVisible(false);
    const showControls = () => {
      setIsControlsVisible(true);
      if (controlsHideTimeoutRef.current)
        clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = setTimeout(hideControls, 3000);
    };

    const container = videoContainerRef.current;
    if (container) {
      container.addEventListener("mousemove", showControls);
      container.addEventListener("mousedown", showControls);
      container.addEventListener("touchstart", showControls);
      container.addEventListener("keydown", showControls);
    }

    showControls();

    return () => {
      if (controlsHideTimeoutRef.current)
        clearTimeout(controlsHideTimeoutRef.current);
      if (container) {
        container.removeEventListener("mousemove", showControls);
        container.removeEventListener("mousedown", showControls);
        container.removeEventListener("touchstart", showControls);
        container.removeEventListener("keydown", showControls);
      }
    };
  }, [isFullscreen]);

  // --- Handlers ---
  const extractVideoId = (url) => {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      if (params.get("v")) return params.get("v");
      if (urlObj.hostname.includes("youtu.be"))
        return urlObj.pathname.substring(1);
    } catch {}
    return url.trim();
  };

  const handleVideoChange = () => {
    if (!videoUrlInput.trim()) return;

    const newId = extractVideoId(videoUrlInput);

    // Check if that ID is valid BEFORE applying
    fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${newId}&format=json`
    )
      // .then((res) => {
      //   if (!res.ok) throw new Error("Invalid");

      //   // Valid video → Apply it
      //   setVideoId(newId);
      //   socketRef.current?.emit("video-action", {
      //     roomId,
      //     action: "changeVideo",
      //     videoId: newId,
      //     time: 0,
      //   });
      //   setVideoUrlInput("");
      //   setVideoError("");
      // })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid");

        // Valid video → Apply it
        setVideoId(newId);

        // Immediately cue the video locally
        if (playerRef.current && isPlayerReady) {
          playerRef.current.cueVideoById({
            videoId: newId,
            startSeconds: 0,
          });
          setIsPlaying(false);
        }

        socketRef.current?.emit("video-action", {
          roomId,
          action: "changeVideo",
          videoId: newId,
          time: 0,
        });
        setVideoUrlInput("");
        setVideoError("");
      })
      .catch(() => {
        toast.error("Invalid video link. Please try another link.");
        setVideoUrlInput("");
      });
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    const messageToSend = { username: localUsername, message: input };
    socketRef.current?.emit("chat-message", {
      roomId,
      message: input,
      username: localUsername,
    });
    setMessages((prev) => [...prev, messageToSend]);
    setInput("");
  };

  const sendVideoAction = (action, time) => {
    if (!socketRef.current || !playerRef.current) return;

    const current = playerRef.current.getCurrentTime();
    const payload = { roomId, action, time: time ?? current };

    if (action === "changeVideo") payload.videoId = videoId;

    socketRef.current.emit("video-action", payload);

    // Optimistic local update
    if (action === "play") {
      playerRef.current.playVideo();
      setIsPlaying(true);
    }
    if (action === "pause") {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    }
    if (action === "seek") {
      playerRef.current.seekTo(payload.time, true);
      setCurrentTime(payload.time);
    }
  };

  const handlePlayPause = (event) => {
    event.stopPropagation();

    isRemoteActionRef.current = true;

    const newPlayingState = !isPlaying;
    const currentPlayerTime = playerRef.current?.getCurrentTime() || 0;

    // Send current time along with play/pause action for better sync
    socketRef.current?.emit("video-action", {
      roomId,
      action: newPlayingState ? "play" : "pause",
      time: currentPlayerTime,
    });

    if (newPlayingState) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
    setIsPlaying(newPlayingState);

    setTimeout(() => {
      isRemoteActionRef.current = false;
    }, 1000);

    resetControlsTimer();
  };

  const handleSeekMouseDown = () => {
    setIsSeeking(true);
    if (controlsHideTimeoutRef.current)
      clearTimeout(controlsHideTimeoutRef.current);
  };

  const handleSeekMouseUp = (e) => {
    setIsSeeking(false);
    const seekTime = parseFloat(e.target.value);

    // Immediately update local player
    if (playerRef.current && isPlayerReady) {
      playerRef.current.seekTo(seekTime, true);
      setCurrentTime(seekTime);
    }

    // Then broadcast to others
    sendVideoAction("seek", seekTime);
    resetControlsTimer();
  };

  const handleSeek = (e) => {
    setCurrentTime(parseFloat(e.target.value));
    resetControlsTimer();
  };

  // const handleFullscreenToggle = (event) => {
  //   event.stopPropagation();
  //   if (!videoContainerRef.current) return;

  //   if (!document.fullscreenElement) {
  //     requestFullscreen(videoContainerRef.current);
  //     setIsFullscreen(true);
  //   } else {
  //     exitFullscreen();
  //     setIsFullscreen(false);
  //   }
  // };

  const handleFullscreenToggle = async (event) => {
    event.stopPropagation();
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      requestFullscreen(videoContainerRef.current);
      setIsFullscreen(true);

      // Lock orientation to landscape on mobile devices
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock("landscape").catch((err) => {
            console.log("Orientation lock not supported or failed:", err);
          });
        }
      } catch (err) {
        console.log("Screen orientation API not available");
      }
    } else {
      exitFullscreen();
      setIsFullscreen(false);

      // Unlock orientation when exiting fullscreen
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch (err) {
        console.log("Screen orientation unlock failed");
      }
    }
  };

  const handleLeaveRoom = () => {
    if (window.confirm("Are you sure you want to leave this room?"))
      navigate("/");
  };

  const handleDeleteRoom = async () => {
    if (
      !window.confirm(
        "⚠️ Are you sure you want to delete this room? All users will be disconnected."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `https://youtube-watchtogether.onrender.com/api/rooms/${roomId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: localUsername,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to delete room");
        return;
      }

      toast.success("Room deleted successfully");
      navigate("/");
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error("Failed to delete room. Please try again.");
    }
  };

  // --- ControlsOverlay Component ---
  const ControlsOverlay = ({
    isFullscreen,
    isVisible,
    isSeeking,
    duration,
    currentTime,
    isPlayerReady,
    handlePlayPause,
    handleSeek,
    handleSeekMouseDown,
    handleSeekMouseUp,
    handleFullscreenToggle,
    playerRef,
    sendVideoAction,
  }) => {
    // if (isFullscreen) {
    //   return null;
    // }
    // Hide custom controls on mobile screens (below 768px)
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    React.useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Don't render custom controls on mobile
    if (isMobile) {
      return null;
    }
    const controlsBarClasses = `
  ${
    isFullscreen
      ? `absolute inset-x-0 bottom-0 p-4 pt-8 bg-gradient-to-t from-black/80 to-transparent
      transition-all duration-700 ease-in-out
      ${
        isVisible || isSeeking ? "opacity-100" : "opacity-0 pointer-events-none"
      }`
      : "absolute inset-x-0 bottom-0 p-2 flex flex-col bg-gray-800 rounded-b-xl shadow-md z-30"
  }
`;

    return (
      <div className={controlsBarClasses}>
        <div
          className={`flex items-center gap-2 sm:gap-3 ${
            !isFullscreen ? "mb-2" : ""
          }`}
        >
          <span className="text-sm text-gray-200 w-10 text-right shrink-0">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(duration, 0)}
            value={currentTime}
            step="1"
            onChange={handleSeek}
            onMouseDown={handleSeekMouseDown}
            onMouseUp={handleSeekMouseUp}
            onTouchStart={handleSeekMouseDown}
            onTouchEnd={handleSeekMouseUp}
            disabled={!isPlayerReady || duration === 0}
            className="flex-1 h-4 rounded-lg appearance-none cursor-pointer bg-gray-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg touch-action-none"
          />
          <span className="text-sm text-gray-200 w-10 shrink-0">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex justify-between items-center mt-2">
          <div className="flex gap-2">
            <button
              onClick={handlePlayPause}
              className={`p-2 rounded-full transition-all ${
                isPlayerReady
                  ? "bg-cyan-500 hover:bg-cyan-600 text-gray-900"
                  : "bg-gray-600 opacity-50 cursor-not-allowed"
              }`}
              disabled={!isPlayerReady}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? (
                <Pause size={isFullscreen ? 24 : 20} className="fill-current" />
              ) : (
                <Play size={isFullscreen ? 24 : 20} className="fill-current" />
              )}
            </button>

            <button
              onClick={() => {
                const time =
                  playerRef.current && isPlayerReady
                    ? playerRef.current.getCurrentTime()
                    : 0;
                sendVideoAction("seek", time);
              }}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                isPlayerReady
                  ? "bg-purple-500 hover:bg-purple-600"
                  : "bg-gray-600 opacity-50 cursor-not-allowed"
              }`}
              disabled={!isPlayerReady}
              title="Sync Video Position with Room"
            >
              Sync
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={handleFullscreenToggle}
              className={`p-2 rounded-full transition-all ${
                isPlayerReady
                  ? "bg-gray-700/70 hover:bg-gray-600/90 text-white"
                  : "bg-gray-600 opacity-50 cursor-not-allowed"
              }`}
              disabled={!isPlayerReady}
              title={
                isFullscreen ? "Exit Fullscreen (Esc)" : "Toggle Fullscreen"
              }
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --------- Render ----------
  const videoContainerClasses = `relative bg-black rounded-xl shadow-2xl ${
    isFullscreen
      ? "fixed top-0 left-0 w-full h-full z-[100] flex justify-center items-center overflow-hidden"
      : "w-full lg:flex-1 aspect-video lg:aspect-auto overflow-hidden"
  }`;

  return (
    <div className="flex flex-col min-h-screen h-screen overflow-hidden bg-gray-900 text-white antialiased p-2 sm:p-4">
      <header className="bg-gray-800 rounded-xl shadow-lg lg:p-4 p-3 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <h1 className="text-xl font-bold text-white">
              Watch<span className="text-cyan-400">Together</span>{" "}
              <span className="text-cyan-400 text-sm ml-1">
                | Room: {roomId}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                    toast.success("Room code copied!");
                  }}
                  className="text-white hover:text-cyan-400 transition"
                  title="Copy Room Code"
                >
                  <Copy size={18} className="" />
                </button>
              </span>
            </h1>

            <button
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              className="sm:hidden ml-4 p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition text-white"
            >
              {isHeaderCollapsed ? (
                <ChevronDown size={20} />
              ) : (
                <ChevronUp size={20} />
              )}
            </button>
          </div>

          <div
            className={`transition-all duration-300 overflow-hidden ${
              isHeaderCollapsed
                ? "max-h-0 opacity-0"
                : "max-h-64 opacity-100 sm:max-h-none"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 w-full">
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Enter YouTube URL or Video ID"
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVideoChange()}
                  className="p-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none w-full sm:w-72"
                />
                <button
                  onClick={handleVideoChange}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-semibold rounded-lg transition shadow-md w-full sm:w-auto"
                >
                  Load Video
                </button>
              </div>

              {localUsername !== hostName && (
                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 mt-2 lg:mt-0 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition shadow-md w-full sm:w-auto"
                >
                  <LogOut className="inline mr-2" size={18} />
                  Leave Room
                </button>
              )}

              {localUsername === hostName && (
                <button
                  onClick={handleDeleteRoom}
                  className="px-4 py-2 mt-2 lg:mt-0 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition shadow-md w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  <LogOut className="inline mr-2" size={18} />
                  Delete Room
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div
        className={`flex flex-col lg:flex-row w-full gap-4 flex-1 overflow-hidden`}
      >
        <div className={`flex-col w-full lg:w-1/2 flex-[0.5] h-full sm:h-auto`}>
          <div
            ref={videoContainerRef}
            className={`${videoContainerClasses} flex justify-center items-center h-full`}
          >
            {!isPlayerReady && (
              <div className="absolute inset-0 flex justify-center items-center text-gray-400 z-10 bg-black/50">
                {" "}
                Loading YouTube Player...
              </div>
            )}
            <div
              ref={playerDivRef}
              id="player"
              className="w-full h-full rounded-xl overflow-hidden"
            />

            <ControlsOverlay
              isFullscreen={isFullscreen}
              isVisible={isControlsVisible}
              isSeeking={isSeeking}
              duration={duration}
              currentTime={currentTime}
              isPlayerReady={isPlayerReady}
              handlePlayPause={handlePlayPause}
              handleSeek={handleSeek}
              handleSeekMouseDown={handleSeekMouseDown}
              handleSeekMouseUp={handleSeekMouseUp}
              handleFullscreenToggle={handleFullscreenToggle}
              playerRef={playerRef}
              sendVideoAction={sendVideoAction}
            />
          </div>
        </div>

        <div
          className={`flex flex-col bg-gray-800 rounded-xl p-4 shadow-xl
  w-full lg:w-1/2 flex-[0.5] h-1/2 sm:h-auto overflow-hidden
  ${isFullscreen ? "hidden" : ""}
  `}
        >
          <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-3">
            <div className="font-bold text-lg">Room Chat</div>

            <button
              onClick={() => setShowUsers(!showUsers)}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 transition"
            >
              {showUsers ? "Hide Users" : "Show Users"}
              {showUsers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showUsers && (
            <div className="bg-gray-800 rounded-xl mb-3 max-h-48 overflow-y-auto shadow-inner">
              <div className="font-semibold text-cyan-400 mb-2 text-sm tracking-wide">
                Active Users ({users.length})
              </div>

              {users.length > 0 ? (
                <ul className="space-y-2">
                  {users.map((user, idx) => (
                    <li
                      key={user.id || idx}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                            user.name === localUsername
                              ? "bg-green-500 text-white"
                              : "bg-gray-600 text-gray-200"
                          }`}
                        >
                          {user.name[0].toUpperCase()}
                        </div>

                        <span
                          className={`font-medium ${
                            user.name === localUsername
                              ? "text-green-400"
                              : "text-gray-200"
                          }`}
                        >
                          {user.name}
                        </span>
                      </div>

                      {user.name === hostName && (
                        <span className="text-yellow-400 text-xs font-bold bg-yellow-500/20 px-2 py-0.5 rounded-md">
                          ⭐ Host
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm text-center py-2">
                  No active users
                </p>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {messages.map((m, idx) => (
              <div key={idx} className="mb-2 break-words text-sm">
                <strong
                  className={`${
                    m.username === localUsername
                      ? "text-cyan-400"
                      : m.username === "System"
                      ? "text-yellow-300"
                      : "text-white"
                  }`}
                >
                  {m.username}
                </strong>
                : <span className="ml-1 text-gray-300">{m.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              className="flex-1 p-3 bg-gray-700 border border-gray-600 text-white outline-none rounded-lg focus:ring-cyan-400 focus:border-cyan-400"
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-semibold rounded-lg transition-colors"
            >
              Send
            </button>
          </div> */}

          <div className="mt-3 flex gap-2 items-stretch">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              className="flex-1 p-2 sm:p-3 bg-gray-700 border border-gray-600 text-white outline-none rounded-lg focus:ring-cyan-400 focus:border-cyan-400 text-sm sm:text-base min-w-0"
            />
            <button
              onClick={sendMessage}
              className="px-3 sm:px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-semibold rounded-lg transition-colors text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <footer
        className={`mt-4 text-xs text-gray-600 text-center ${
          isFullscreen ? "hidden" : ""
        }`}
      >
        Host:{" "}
        <span className="text-gray-400 font-semibold">
          {" "}
          {hostName || "Loading..."}{" "}
        </span>{" "}
        | Youtube Watch Together - By Akshat
      </footer>
    </div>
  );
};

export default WatchTogetherRoom;
