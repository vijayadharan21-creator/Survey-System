const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  createProposal,
  getMyProposals,
  startSurvey,
} = require("../controllers/proposalController");

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("USER", "SURVEYER"),
  createProposal
);

router.get(
  "/my",
  authenticate,
  authorize("USER", "SURVEYER"),
  getMyProposals
);

router.post(
  "/:id/start-survey",
  authenticate,
  authorize("USER", "SURVEYER"),
  startSurvey
);

module.exports = router;