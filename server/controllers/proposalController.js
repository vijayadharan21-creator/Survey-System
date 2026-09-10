const Proposal = require("../models/Proposal");
const {
  createProposalSchema,
} = require("../validators/proposalValidator");

const createProposal = async (req, res) => {
  try {
    const result = createProposalSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid proposal data",
        errors: result.error.issues,
      });
    }

    const {
      title,
      description,
      purpose,
      location,
      startDate,
      endDate,
    } = result.data;

    const proposal = await Proposal.create({
      userId: req.user._id,

      title,
      description,
      purpose,
      location,
      startDate,
      endDate,

      status: "PENDING",
    });

    return res.status(201).json({
      message: "Proposal submitted successfully",

      proposal: {
        id: proposal._id,
        title: proposal.title,
        status: proposal.status,
        createdAt: proposal.createdAt,
      },
    });
  } catch (error) {
    console.error("Create proposal error:", error);

    return res.status(500).json({
      message: "Server error while creating proposal",
    });
  }
};

const getMyProposals = async (req, res) => {
  try {
    const proposals = await Proposal.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    const Survey = require("../models/Survey");
    const Report = require("../models/Report");

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

    const User = require("../models/User");
    const freshUser = await User.findById(req.user._id).select("-password");

    return res.status(200).json({
      proposals: enrichedProposals,
      user: freshUser,
    });
  } catch (error) {
    console.error("Get proposals error:", error);

    return res.status(500).json({
      message: "Server error while fetching proposals",
    });
  }
};

const startSurvey = async (req, res) => {
  try {
    const { id } = req.params;
    const proposal = await Proposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    if (proposal.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only start surveys for your own proposals" });
    }

    if (proposal.status !== "APPROVED") {
      return res.status(400).json({
        message: `This proposal cannot be started because its status is ${proposal.status}.`,
      });
    }

    const Survey = require("../models/Survey");
    const Report = require("../models/Report");
    const User = require("../models/User");
    const generateSurveyerId = require("../utils/generateSurveyerId");
    const generateToken = require("../utils/generateToken");

    // Ensure this proposal doesn't already have a submitted report
    const existingReport = await Report.findOne({ proposalId: proposal._id });
    if (existingReport) {
      proposal.status = "COMPLETED";
      await proposal.save();
      return res.status(400).json({
        message: "This survey has already been completed and finalized.",
      });
    }

    // Check if a survey already exists for this proposal
    let survey = await Survey.findOne({ proposalId: proposal._id });

    // Update user account to active SURVEYER session
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.surveyerId) {
      user.surveyerId = await generateSurveyerId(proposal.location?.city || "GEN");
    }

    user.role = "SURVEYER";
    user.surveyerStatus = "ACTIVE";
    user.proposalId = proposal._id;
    user.surveyId = survey ? survey._id : null;
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      message: "Survey session initialized successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
        surveyerId: user.surveyerId,
        surveyerStatus: user.surveyerStatus,
        proposalId: user.proposalId,
        surveyId: user.surveyId,
      },
      proposal,
      survey,
    });
  } catch (error) {
    console.error("Start survey error:", error);
    return res.status(500).json({ message: "Server error while starting survey" });
  }
};

module.exports = {
  createProposal,
  getMyProposals,
  startSurvey,
};