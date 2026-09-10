const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  submitResponse,
} = require("../controllers/responseController");

const router = express.Router();

router.post(
  "/surveys/:id/responses",
  authenticate,
  authorize("USER"),
  submitResponse
);

module.exports = router;