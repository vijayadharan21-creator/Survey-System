const Proposal  = require("../models/Proposal");
const User       = require("../models/User");
const Notification = require("../models/Notification");
const Report     = require("../models/Report");
const Survey     = require("../models/Survey");
const Response   = require("../models/Response");
const generateSurveyerId = require("../utils/generateSurveyerId");

// ── Get all proposals ──────────────────────────────────────────────
const getProposals = async (req, res) => {
  try {
    const proposals = await Proposal.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const proposalIds = proposals.map((p) => p._id);
    const surveys = await Survey.find({ proposalId: { $in: proposalIds } }).lean();
    const surveyMap = {};
    surveys.forEach((s) => {
      surveyMap[s.proposalId.toString()] = s;
    });

    const surveyIds = surveys.map((s) => s._id);
    const reports = await Report.find({ surveyId: { $in: surveyIds } }).lean();
    const reportMap = {};
    reports.forEach((r) => {
      reportMap[r.surveyId.toString()] = r;
    });

    const enrichedProposals = await Promise.all(
      proposals.map(async (p) => {
        const associatedSurvey = surveyMap[p._id.toString()];
        const associatedReport = associatedSurvey ? reportMap[associatedSurvey._id.toString()] : null;

        let currentStatus = p.status;
        if (
          p.status === "APPROVED" &&
          (associatedReport || (associatedSurvey && associatedSurvey.status === "COMPLETED"))
        ) {
          currentStatus = "COMPLETED";
          if (p.status !== "COMPLETED") {
            await Proposal.findByIdAndUpdate(p._id, { status: "COMPLETED" });
          }
        }

        return {
          ...p.toObject(),
          status: currentStatus,
          survey: associatedSurvey || null,
          report: associatedReport || null,
        };
      })
    );

    return res.status(200).json({ proposals: enrichedProposals });
  } catch (error) {
    console.error("Get admin proposals error:", error);
    return res.status(500).json({ message: "Server error while fetching proposals" });
  }
};

// ── Get all users ──────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role surveyerId surveyerStatus authProvider createdAt")
      .sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({ message: "Server error while fetching users" });
  }
};

// ── Get all submitted reports ──────────────────────────────────────
const getAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate({ path: "surveyId", select: "title surveyId location startTime endTime status questions description" })
      .populate({ path: "surveyerUserId", select: "name email surveyerId" })
      .sort({ createdAt: -1 });
    return res.status(200).json({ reports });
  } catch (error) {
    console.error("Get all reports error:", error);
    return res.status(500).json({ message: "Server error while fetching reports" });
  }
};

// ── Approve proposal ───────────────────────────────────────────────
const approveProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    if (proposal.status !== "PENDING")
      return res.status(400).json({ message: `Proposal is already ${proposal.status.toLowerCase()}` });

    const user = await User.findById(proposal.userId);
    if (!user) return res.status(404).json({ message: "Proposal owner not found" });
    if (user.role !== "USER")
      return res.status(400).json({ message: "This user is not eligible for Surveyer authorization" });

    const surveyerId = await generateSurveyerId(proposal.location.city);
    proposal.status     = "APPROVED";
    proposal.reviewedBy = req.user._id;
    proposal.reviewedAt = new Date();
    await proposal.save();

    user.role           = "SURVEYER";
    user.surveyerId     = surveyerId;
    user.surveyerStatus = "ACTIVE";
    user.proposalId     = proposal._id;
    user.surveyId       = null;
    await user.save();

    await Notification.create({
      userId:  user._id,
      title:   "Proposal Approved",
      message: `Your proposal has been approved. Your Surveyer ID is ${surveyerId}.`,
      type:    "PROPOSAL_APPROVED",
      isRead:  false,
    });

    return res.status(200).json({ message: "Proposal approved successfully", surveyerId, proposalId: proposal._id });
  } catch (error) {
    console.error("Approve proposal error:", error);
    return res.status(500).json({ message: "Server error while approving proposal" });
  }
};

// ── Reject proposal ────────────────────────────────────────────────
const rejectProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim().length < 5)
      return res.status(400).json({ message: "A valid rejection reason is required" });

    const proposal = await Proposal.findById(id);
    if (!proposal) return res.status(404).json({ message: "Proposal not found" });
    if (proposal.status !== "PENDING")
      return res.status(400).json({ message: `Proposal is already ${proposal.status.toLowerCase()}` });

    proposal.status          = "REJECTED";
    proposal.rejectionReason = reason.trim();
    proposal.reviewedBy      = req.user._id;
    proposal.reviewedAt      = new Date();
    await proposal.save();

    await Notification.create({
      userId:  proposal.userId,
      title:   "Proposal Rejected",
      message: `Your proposal was rejected. Reason: ${reason.trim()}`,
      type:    "PROPOSAL_REJECTED",
      isRead:  false,
    });

    return res.status(200).json({ message: "Proposal rejected successfully" });
  } catch (error) {
    console.error("Reject proposal error:", error);
    return res.status(500).json({ message: "Server error while rejecting proposal" });
  }
};

// ── Get all surveys across system (with live conducting status & response counts) ─
const getAllSurveys = async (req, res) => {
  try {
    const surveys = await Survey.find()
      .populate("surveyerUserId", "name email surveyerId")
      .populate("proposalId", "title purpose")
      .sort({ createdAt: -1 })
      .lean();

    const surveyIds = surveys.map((s) => s._id);

    const responseCounts = await Response.aggregate([
      { $match: { surveyId: { $in: surveyIds } } },
      { $group: { _id: "$surveyId", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    responseCounts.forEach((r) => {
      countMap[r._id.toString()] = r.count;
    });

    const now = new Date();
    const enrichedSurveys = surveys.map((s) => {
      const isConductingNow =
        s.status === "PUBLISHED" &&
        s.startTime &&
        s.endTime &&
        now >= new Date(s.startTime) &&
        now <= new Date(s.endTime);

      return {
        ...s,
        responseCount: countMap[s._id.toString()] || 0,
        isConductingNow: !!isConductingNow,
      };
    });

    return res.status(200).json({ surveys: enrichedSurveys });
  } catch (error) {
    console.error("Get admin surveys error:", error);
    return res.status(500).json({ message: "Server error while fetching surveys" });
  }
};

module.exports = { getProposals, getAllUsers, getAllReports, getAllSurveys, approveProposal, rejectProposal };