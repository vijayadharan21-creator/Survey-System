const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const { register, login, getProfile, updateProfile } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login",    login);
router.get("/profile",   authenticate, getProfile);
router.put("/profile",   authenticate, updateProfile);

module.exports = router;