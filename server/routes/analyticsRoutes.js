const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  getSurveyAnalytics,
} = require("../controllers/analyticsController");

const router = express.Router();

router.get(
  "/surveys/:id/analytics",
  authenticate,
  authorize("SURVEYER", "ADMIN"),
  getSurveyAnalytics
);

module.exports = router;