const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const authorize    = require("../middleware/roleMiddleware");
const {
  getProposals,
  getAllUsers,
  getAllReports,
  getAllSurveys,
  approveProposal,
  rejectProposal,
} = require("../controllers/adminController");

const router = express.Router();

// Proposals
router.get("/proposals",              authenticate, authorize("ADMIN"), getProposals);
router.patch("/proposals/:id/approve",authenticate, authorize("ADMIN"), approveProposal);
router.patch("/proposals/:id/reject", authenticate, authorize("ADMIN"), rejectProposal);

// Active Surveys across system
router.get("/surveys",                authenticate, authorize("ADMIN"), getAllSurveys);

// Manage Accounts
router.get("/users",                  authenticate, authorize("ADMIN"), getAllUsers);

// Report History
router.get("/reports",                authenticate, authorize("ADMIN"), getAllReports);

module.exports = router;