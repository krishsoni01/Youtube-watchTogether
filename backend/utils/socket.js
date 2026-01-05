const {
  joinRoomController,
  videoActionController,
  chatMessageController,
  disconnectingController,
} = require("../controllers/socket.controller");

const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    const { userId, roomId, username: clientName } = socket.handshake.query;

    socket.data.userId = userId || null;
    socket.data.username =
      clientName || `User-${userId ? userId.substring(0, 4) : "Anon"}`;

    console.log(
      `✅ User connected: ${socket.id} (${socket.data.username}, ID: ${
        userId || "none"
      })`
    );

    socket.on("error", (err) => {
      console.error(`Socket Error for ${socket.id}:`, err);
    });

    socket.on("joinRoom", joinRoomController(socket, io));

    socket.on("video-action", videoActionController(socket, io));

    socket.on("chat-message", chatMessageController(socket, io));

    socket.on("disconnecting", disconnectingController(socket, io));
  });
};

module.exports = setupSocketHandlers;
