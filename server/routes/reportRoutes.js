const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  generateReport,
  submitReport,
  getMyReports,
  getReportById,
} = require("../controllers/reportController");

const router = express.Router();

router.get("/reports/my", authenticate, getMyReports);
router.get("/reports/:id", authenticate, getReportById);

router.post(
  "/surveys/:id/report",
  authenticate,
  authorize("SURVEYER"),
  generateReport
);

router.patch(
  "/reports/:id/submit",
  authenticate,
  authorize("SURVEYER"),
  submitReport
);

module.exports = router;