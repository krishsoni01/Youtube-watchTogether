const Room = require("../models/room");
const Message = require("../models/message");

const INACTIVITY_THRESHOLD = 60 * 60 * 1000; // 1 hour in milliseconds

const cleanupInactiveRooms = async (io) => {
  try {
    const cutoffTime = Date.now() - INACTIVITY_THRESHOLD;

    const inactiveRooms = await Room.find({
      lastActive: { $lt: new Date(cutoffTime) },
    });

    if (inactiveRooms.length > 0) {
      console.log(
        `🧹 Found ${inactiveRooms.length} inactive room(s) to clean up`
      );

      for (const room of inactiveRooms) {
        io.in(room.roomCode).emit("roomDeleted", {
          message: "Room closed due to inactivity (1 hour).",
        });

        const sockets = await io.in(room.roomCode).fetchSockets();
        for (const socket of sockets) {
          socket.leave(room.roomCode);
          socket.disconnect(true);
        }

        // 🔥 Delete all messages for this room
        await Message.deleteMany({ roomCode: room.roomCode });
        console.log(`🗑️ Deleted messages for room: ${room.roomCode}`);
      }

      const result = await Room.deleteMany({
        lastActive: { $lt: new Date(cutoffTime) },
      });

      console.log(`✅ Cleaned up ${result.deletedCount} inactive room(s)`);
    }
  } catch (error) {
    console.error("❌ Error during inactive room cleanup:", error.message);
  }
};

module.exports = { cleanupInactiveRooms };
