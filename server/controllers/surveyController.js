const Survey = require("../models/Survey");
const Proposal = require("../models/Proposal");
const calculateDistance = require("../utils/distance");
const Notification = require("../models/Notification");

const {
  createSurveySchema,
  updateSurveySchema,
} = require("../Validators/surveyValidator");

const validateSurveyForPublish = require(
  "../Validators/publishSurveyValidator"
);

const updateSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    const result = updateSurveySchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid survey data",
        errors: result.error.issues,
      });
    }

    const survey = await Survey.findById(id);

    if (!survey) {
      return res.status(404).json({
        message: "Survey not found",
      });
    }

    // Survey ownership check
    if (
      survey.surveyerUserId.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only edit your own survey",
      });
    }

    // Surveyer must still be active
    if (
      req.user.role !== "SURVEYER" ||
      req.user.surveyerStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        message: "Your Surveyer authorization is no longer active",
      });
    }

    // Cannot edit completed survey
    if (survey.status === "COMPLETED") {
      return res.status(400).json({
        message: "Completed surveys cannot be edited",
      });
    }

    // Published survey can only be edited before it starts
    if (
      survey.status === "PUBLISHED" &&
      new Date() >= new Date(survey.startTime)
    ) {
      return res.status(400).json({
        message: "A survey cannot be edited after it has started",
      });
    }

    const {
      title,
      description,
      questions,
      location,
      startTime,
      endTime,
    } = result.data;

    survey.title = title;
    survey.description = description;
    survey.questions = questions;
    survey.location = location;
    survey.startTime = startTime;
    survey.endTime = endTime;

    await survey.save();

    return res.status(200).json({
      message: "Survey updated successfully",
      survey,
    });
  } catch (error) {
    console.error("Update survey error:", error);

    return res.status(500).json({
      message: "Server error while updating survey",
    });
  }
};

const generateSurveyId = require("../utils/generateSurveyId");

const createSurvey = async (req, res) => {
  try {
    // 1. Validate request
    const result = createSurveySchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid survey data",
        errors: result.error.issues,
      });
    }

    // 2. Current Surveyer information comes from database
    const surveyer = req.user;

    if (
      surveyer.role !== "SURVEYER" ||
      surveyer.surveyerStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        message: "You are not an active Surveyer",
      });
    }

    if (!surveyer.proposalId) {
      return res.status(400).json({
        message: "No approved proposal is associated with you",
      });
    }

    // 3. Find the approved proposal
    const proposal = await Proposal.findById(
      surveyer.proposalId
    );

    if (!proposal) {
      return res.status(404).json({
        message: "Approved proposal not found",
      });
    }

    if (proposal.status !== "APPROVED") {
      return res.status(400).json({
        message: "The associated proposal is not approved",
      });
    }

    // 4. Make sure this proposal doesn't already have a survey
    const existingSurvey = await Survey.findOne({
      proposalId: proposal._id,
    });

    if (existingSurvey) {
      return res.status(409).json({
        message: "A survey has already been created for this proposal",
      });
    }

    // 5. Make sure Surveyer doesn't already have a survey
    if (surveyer.surveyId) {
      return res.status(409).json({
        message: "You have already created your survey",
      });
    }

    const {
      title,
      description,
      questions,
      location,
      startTime,
      endTime,
    } = result.data;

    // 6. Generate survey ID
    const surveyId = await generateSurveyId();

    // 7. Create survey
    const survey = await Survey.create({
      surveyId,

      proposalId: proposal._id,

      surveyerUserId: surveyer._id,

      surveyerId: surveyer.surveyerId,

      title,
      description,
      questions,
      location,
      startTime,
      endTime,

      status: "DRAFT",
    });

    // 8. Connect survey back to user
    surveyer.surveyId = survey._id;

    await surveyer.save();

    return res.status(201).json({
      message: "Survey created successfully",

      survey: {
        id: survey._id,
        surveyId: survey.surveyId,
        title: survey.title,
        status: survey.status,
      },
    });
  } catch (error) {
    console.error("Create survey error:", error);

    // Duplicate proposalId / surveyId
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A survey already exists for this proposal",
      });
    }

    return res.status(500).json({
      message: "Server error while creating survey",
    });
  }
};
const getMySurvey = async (req, res) => {
  try {
    const Proposal = require("../models/Proposal");
    const Report = require("../models/Report");
    const User = require("../models/User");

    let proposal = null;
    if (req.user.proposalId) {
      proposal = await Proposal.findById(req.user.proposalId);
    }

    let survey = null;
    if (req.user.surveyId) {
      survey = await Survey.findById(req.user.surveyId).populate(
        "proposalId",
        "title description purpose location startDate endDate status"
      );
    } else if (req.user.proposalId) {
      survey = await Survey.findOne({
        proposalId: req.user.proposalId,
      }).populate(
        "proposalId",
        "title description purpose location startDate endDate status"
      );
    }

    if (!survey && req.user._id) {
      // Check if user owns an active (non-completed) survey
      survey = await Survey.findOne({
        surveyerUserId: req.user._id,
        status: { $ne: "COMPLETED" },
      }).populate(
        "proposalId",
        "title description purpose location startDate endDate status"
      );
    }

    // Check if report already exists for THIS active survey or proposal
    let existingReport = null;
    if (survey) {
      existingReport = await Report.findOne({ surveyId: survey._id });
    } else if (proposal) {
      existingReport = await Report.findOne({ proposalId: proposal._id });
    }

    if (existingReport) {
      if (req.user.role === "SURVEYER") {
        await User.findByIdAndUpdate(req.user._id, {
          role: "USER",
          surveyerStatus: "COMPLETED",
        });
      }
      return res.status(200).json({
        survey: survey || null,
        proposal: proposal || null,
        reportAlreadyGenerated: true,
        report: existingReport,
      });
    }

    return res.status(200).json({
      survey: survey || null,
      proposal: proposal || (survey?.proposalId || null),
      reportAlreadyGenerated: false,
    });
  } catch (error) {
    console.error("Get my survey error:", error);
    return res.status(500).json({ message: "Server error while fetching survey" });
  }
};

const previewSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await Survey.findById(id);

    if (!survey) {
      return res.status(404).json({
        message: "Survey not found",
      });
    }

    if (
      survey.surveyerUserId.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only preview your own survey",
      });
    }

    return res.status(200).json({
      survey: {
        surveyId: survey.surveyId,
        title: survey.title,
        description: survey.description,
        questions: survey.questions,
        location: survey.location,
        startTime: survey.startTime,
        endTime: survey.endTime,
        status: survey.status,
      },
    });
  } catch (error) {
    console.error("Preview survey error:", error);

    return res.status(500).json({
      message: "Server error while previewing survey",
    });
  }
};

const publishSurvey = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await Survey.findById(id);

    if (!survey) {
      return res.status(404).json({
        message: "Survey not found",
      });
    }

    if (
      survey.surveyerUserId.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only publish your own survey",
      });
    }

    if (
      req.user.role !== "SURVEYER" ||
      req.user.surveyerStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        message: "You are not an active Surveyer",
      });
    }

    if (survey.status !== "DRAFT") {
      return res.status(400).json({
        message: "Only draft surveys can be published",
      });
    }

    const { startTime, endTime } = req.body || {};
    if (startTime) {
      survey.startTime = new Date(startTime);
    }
    if (endTime) {
      survey.endTime = new Date(endTime);
    }

    const validationError =
      validateSurveyForPublish(survey);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    survey.status = "PUBLISHED";

    await survey.save();

    // Notify the Surveyer
    await Notification.create({
      userId: req.user._id,
      title: "Survey Published",
      message: `Your survey ${survey.surveyId} has been published successfully.`,
      type: "SURVEY_PUBLISHED",
      isRead: false,
    });

    return res.status(200).json({
      message: "Survey published successfully",
      survey: {
        surveyId: survey.surveyId,
        status: survey.status,
        startTime: survey.startTime,
        endTime: survey.endTime,
      },
    });
  } catch (error) {
    console.error("Publish survey error:", error);

    return res.status(500).json({
      message: "Server error while publishing survey",
    });
  }
};

const getAvailableSurveys = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: "Valid latitude and longitude are required",
      });
    }

    const now = new Date();

    const surveys = await Survey.find({
      status: "PUBLISHED",
      startTime: { $lte: now },
      endTime: { $gte: now },
    })
      .select(
        "surveyId title description location startTime endTime"
      )
      .lean();

    const availableSurveys = surveys
      .map((survey) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          survey.location.latitude,
          survey.location.longitude
        );

        return {
          ...survey,
          distanceKm: Number(distance.toFixed(2)),
          withinRadius:
            distance <= survey.location.radius,
        };
      })
      .filter((survey) => survey.withinRadius)
      .map((survey) => {
        const { withinRadius, ...result } = survey;

        return result;
      });

    return res.status(200).json({
      surveys: availableSurveys,
    });
  } catch (error) {
    console.error(
      "Get available surveys error:",
      error
    );

    return res.status(500).json({
      message:
        "Server error while fetching available surveys",
    });
  }
};

const getSurveyForParticipation = async (req, res) => {
  try {
    const { id } = req.params;

    const { lat, lng } = req.query;

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return res.status(400).json({
        message:
          "Your location is required to access this survey",
      });
    }

    const survey = await Survey.findById(id).lean();

    if (!survey) {
      return res.status(404).json({
        message: "Survey not found",
      });
    }

    const now = new Date();

    if (survey.status !== "PUBLISHED") {
      return res.status(400).json({
        message: "This survey is not available",
      });
    }

    if (
      now < new Date(survey.startTime) ||
      now > new Date(survey.endTime)
    ) {
      return res.status(400).json({
        message: "This survey is not currently active",
      });
    }

    const distance = calculateDistance(
      latitude,
      longitude,
      survey.location.latitude,
      survey.location.longitude
    );

    if (distance > survey.location.radius) {
      return res.status(403).json({
        message:
          "You are outside the allowed area for this survey",
      });
    }

    return res.status(200).json({
      survey: {
        id: survey._id,
        surveyId: survey.surveyId,
        title: survey.title,
        description: survey.description,
        questions: survey.questions,
        location: survey.location.city,
        startTime: survey.startTime,
        endTime: survey.endTime,
      },
    });
  } catch (error) {
    console.error(
      "Get survey for participation error:",
      error
    );

    return res.status(500).json({
      message:
        "Server error while fetching survey",
    });
  }
};

const getMySurveyHistory = async (req, res) => {
  try {
    const surveys = await Survey.find({ surveyerUserId: req.user._id })
      .populate("proposalId", "title purpose")
      .sort({ createdAt: -1 })
      .lean();

    const surveyIds = surveys.map((s) => s._id);

    const reports = await require("../models/Report").find({
      surveyId: { $in: surveyIds },
    }).lean();

    const reportMap = {};
    reports.forEach((r) => {
      reportMap[r.surveyId.toString()] = r;
    });

    const responseCounts = await require("../models/Response").aggregate([
      { $match: { surveyId: { $in: surveyIds } } },
      { $group: { _id: "$surveyId", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    responseCounts.forEach((r) => {
      countMap[r._id.toString()] = r.count;
    });

    const enriched = surveys.map((s) => ({
      ...s,
      responseCount: countMap[s._id.toString()] || 0,
      report: reportMap[s._id.toString()] || null,
    }));

    return res.status(200).json({ surveys: enriched });
  } catch (error) {
    console.error("Get survey history error:", error);
    return res.status(500).json({ message: "Server error while fetching survey history" });
  }
};

module.exports = {
  createSurvey,
  getMySurvey,
  getMySurveyHistory,
  updateSurvey,
  previewSurvey,
  publishSurvey,
  getSurveyForParticipation,
  getAvailableSurveys,
};