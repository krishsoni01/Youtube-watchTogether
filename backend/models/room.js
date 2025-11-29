const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    roomCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    hostName: {
        type: String,
        required: true
    },
    users: [
        {
            type: String // store usernames or userIds
        }
    ],
    videoId: { type: String, default: null },
    currentTime: { type: Number, default: 0 },
    isPlaying: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
}, {
    versionKey: false
});

module.exports = mongoose.model("Room", RoomSchema);
