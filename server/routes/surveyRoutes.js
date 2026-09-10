const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  createSurvey,
  getMySurvey,
  getMySurveyHistory,
  updateSurvey,
  previewSurvey,
  publishSurvey,
  getAvailableSurveys,
  getSurveyForParticipation,
} = require("../controllers/surveyController");

const router = express.Router();

router.get("/my-history", authenticate, getMySurveyHistory);
router.get("/my-all",     authenticate, getMySurveyHistory);

router.post(
  "/",
  authenticate,
  authorize("SURVEYER"),
  createSurvey
);

router.get(
  "/my",
  authenticate,
  authorize("SURVEYER"),
  getMySurvey
);

router.put(
  "/:id",
  authenticate,
  authorize("SURVEYER"),
  updateSurvey
);

router.get(
  "/:id/preview",
  authenticate,
  authorize("SURVEYER"),
  previewSurvey
);

router.patch(
  "/:id/publish",
  authenticate,
  authorize("SURVEYER"),
  publishSurvey
);

router.get(
  "/available",
  authenticate,
  authorize("USER"),
  getAvailableSurveys
);

router.get(
  "/:id/participate",
  authenticate,
  authorize("USER"),
  getSurveyForParticipation
);

module.exports = router;