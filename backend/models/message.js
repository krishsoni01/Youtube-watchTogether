const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    uppercase: true,
  },
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
messageSchema.index({ roomCode: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);