const express = require("express");
const router = express.Router();
const {
  createRoomController,
  fetchRoomController,
  joinRoomController,
  getUsersController,
  deleteRoomController,
} = require("../controllers/room.controller");

module.exports = (io) => {
  // ===============================
  // POST /api/rooms  -> create room
  // ===============================
  router.post("/", createRoomController);

  // ===============================
  // GET /api/rooms/:roomCode -> fetch room
  // ===============================
  router.get("/:roomCode", fetchRoomController);

  // ===============================
  // PUT /api/rooms/:roomCode/join -> add user
  // ===============================
  router.put("/:roomCode/join", joinRoomController);

  // GET /api/rooms/:roomCode/users -> get users list of a room
  router.get("/:roomCode/users", getUsersController);

  // ===============================
  // DELETE /api/rooms/:roomCode -> delete room (HOST ONLY)
  // ===============================
  router.delete("/:roomCode", deleteRoomController);

  return router;
};
