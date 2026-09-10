const Survey = require("../models/Survey");
const Response = require("../models/Response");
const Report = require("../models/Report");
const User = require("../models/User");
const updateSurveyStatus = require("../utils/updateSurveyStatus");
const generateReportId = require("../utils/generateReportId");

const generateReport = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await Survey.findById(id);

    if (!survey) {
      return res.status(404).json({
        message: "Survey not found",
      });
    }

    // Only the owner can generate the report
    if (
      survey.surveyerUserId.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only generate a report for your own survey",
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

    // Update survey status if end time has passed
    await updateSurveyStatus(survey);

    // Final report can only be generated after survey completion
    if (survey.status !== "COMPLETED") {
      return res.status(400).json({
        message:
          "The survey must be completed before generating the final report",
      });
    }

    // Don't allow multiple reports
    const existingReport = await Report.findOne({
      surveyId: survey._id,
    });

    if (existingReport) {
      return res.status(409).json({
        message: "A report already exists for this survey",
        reportId: existingReport.reportId,
      });
    }

    // Get responses
    const responses = await Response.find({
      surveyId: survey._id,
    }).lean();

    const totalResponses = responses.length;

    // Generate analytics
    const analytics = survey.questions.map((question) => {
      const questionResponses = responses
        .map((response) =>
          response.answers.find(
            (answer) =>
              answer.questionId === question.questionId
          )
        )
        .filter(Boolean);

      // SINGLE CHOICE / YES_NO
      if (
        question.type === "SINGLE_CHOICE" ||
        question.type === "YES_NO"
      ) {
        const options =
          question.type === "YES_NO"
            ? ["Yes", "No"]
            : question.options.map(
                (option) => option.text
              );

        const counts = {};

        options.forEach((option) => {
          counts[option] = 0;
        });

        questionResponses.forEach((item) => {
          if (counts[item.answer] !== undefined) {
            counts[item.answer]++;
          }
        });

        return {
          questionId: question.questionId,
          question: question.text,
          type: question.type,

          results: options.map((option) => ({
            option,
            count: counts[option],
            percentage:
              totalResponses === 0
                ? 0
                : Number(
                    (
                      (counts[option] /
                        totalResponses) *
                      100
                    ).toFixed(2)
                  ),
          })),
        };
      }

      // MULTIPLE CHOICE
      if (question.type === "MULTIPLE_CHOICE") {
        const counts = {};

        question.options.forEach((option) => {
          counts[option.text] = 0;
        });

        questionResponses.forEach((item) => {
          if (Array.isArray(item.answer)) {
            item.answer.forEach((answer) => {
              if (counts[answer] !== undefined) {
                counts[answer]++;
              }
            });
          }
        });

        return {
          questionId: question.questionId,
          question: question.text,
          type: question.type,

          results: question.options.map(
            (option) => ({
              option: option.text,
              count: counts[option.text],
              percentage:
                totalResponses === 0
                  ? 0
                  : Number(
                      (
                        (counts[option.text] /
                          totalResponses) *
                        100
                      ).toFixed(2)
                    ),
            })
          ),
        };
      }

      // RATING
      if (question.type === "RATING") {
        const ratings = questionResponses
          .map((item) => Number(item.answer))
          .filter(
            (rating) =>
              Number.isInteger(rating) &&
              rating >= 1 &&
              rating <= 5
          );

        const counts = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };

        ratings.forEach((rating) => {
          counts[rating]++;
        });

        const average =
          ratings.length === 0
            ? 0
            : Number(
                (
                  ratings.reduce(
                    (sum, rating) => sum + rating,
                    0
                  ) / ratings.length
                ).toFixed(2)
              );

        return {
          questionId: question.questionId,
          question: question.text,
          type: question.type,
          average,

          results: Object.entries(counts).map(
            ([rating, count]) => ({
              option: rating,
              count,
              percentage:
                ratings.length === 0
                  ? 0
                  : Number(
                      (
                        (count / ratings.length) *
                        100
                      ).toFixed(2)
                    ),
            })
          ),
        };
      }

      return {
        questionId: question.questionId,
        question: question.text,
        type: question.type,
        results: [],
      };
    });

    const reportId = await generateReportId();

    const report = await Report.create({
      reportId,

      surveyId: survey._id,
      proposalId: survey.proposalId,

      surveyerUserId: req.user._id,
      surveyerId: req.user.surveyerId,

      totalResponses,
      analytics,

      status: "SUBMITTED",
      submittedAt: new Date(),
    });

    // Mark survey as completed
    survey.status = "COMPLETED";
    await survey.save();

    // Mark associated proposal as COMPLETED
    if (survey.proposalId) {
      const Proposal = require("../models/Proposal");
      await Proposal.findByIdAndUpdate(survey.proposalId, { status: "COMPLETED" });
    }

    // Transition Surveyer back to normal USER immediately upon report generation
    const user = await User.findById(req.user._id);
    if (user) {
      user.role = "USER";
      user.surveyerStatus = "COMPLETED";
      await user.save();
    }

    return res.status(201).json({
      message: "Report generated successfully. Survey cycle completed.",

      report: {
        id: report._id,
        reportId: report.reportId,
        totalResponses: report.totalResponses,
        status: report.status,
        submittedAt: report.submittedAt,
      },

      user: user
        ? {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            authProvider: user.authProvider,
            surveyerId: user.surveyerId,
            surveyerStatus: user.surveyerStatus,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "Generate report error:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "A report already exists for this survey",
      });
    }

    return res.status(500).json({
      message:
        "Server error while generating report",
    });
  }
};

const submitReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    if (
      report.surveyerUserId.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only submit your own report",
      });
    }

    if (report.status === "SUBMITTED") {
      const user = await User.findById(req.user._id);
      if (user && user.role === "SURVEYER") {
        user.role = "USER";
        user.surveyerStatus = "COMPLETED";
        await user.save();
      }
      return res.status(200).json({
        message: "Report is already submitted. Your Surveyer authorization is completed.",
        report: {
          reportId: report.reportId,
          status: report.status,
          submittedAt: report.submittedAt,
        },
        surveyer: user ? {
          surveyerId: user.surveyerId,
          status: user.surveyerStatus,
        } : null,
      });
    }

    if (
      req.user.role !== "SURVEYER" ||
      req.user.surveyerStatus !== "ACTIVE"
    ) {
      return res.status(403).json({
        message: "Your Surveyer authorization is not active",
      });
    }

    const survey = await Survey.findById(
      report.surveyId
    );

    if (!survey) {
      return res.status(404).json({
        message: "Associated survey not found",
      });
    }

    // Make sure survey is completed
    await updateSurveyStatus(survey);

    if (survey.status !== "COMPLETED") {
      return res.status(400).json({
        message:
          "The survey must be completed before submitting the report",
      });
    }

    // Submit report
    report.status = "SUBMITTED";
    report.submittedAt = new Date();

    await report.save();

    // Lock survey
    survey.status = "COMPLETED";
    await survey.save();

    // Mark associated proposal as COMPLETED
    if (survey.proposalId) {
      const Proposal = require("../models/Proposal");
      await Proposal.findByIdAndUpdate(survey.proposalId, { status: "COMPLETED" });
    }

    // Convert Surveyer back to normal User
    const user = await require("../models/User").findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        message: "Surveyer account not found",
      });
    }

    user.role = "USER";
    user.surveyerStatus = "COMPLETED";

    await user.save();

    return res.status(200).json({
      message:
        "Report submitted successfully. Your Surveyer authorization is now completed.",

      report: {
        reportId: report.reportId,
        status: report.status,
        submittedAt: report.submittedAt,
      },

      surveyer: {
        surveyerId: user.surveyerId,
        status: user.surveyerStatus,
      },

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
        surveyerId: user.surveyerId,
        surveyerStatus: user.surveyerStatus,
      },
    });
  } catch (error) {
    console.error(
      "Submit report error:",
      error
    );

    return res.status(500).json({
      message:
        "Server error while submitting report",
    });
  }
};

// ── Get all reports for currently logged-in user ─────────────────
const getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ surveyerUserId: req.user._id })
      .populate({ path: "surveyId", select: "title surveyId location startTime endTime status description" })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      reports,
    });
  } catch (error) {
    console.error("Get my reports error:", error);
    return res.status(500).json({
      message: "Server error while fetching your reports",
    });
  }
};

// ── Get single report by ID with full analytics ───────────────────
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id)
      .populate({ path: "surveyId", select: "title surveyId location startTime endTime status description questions" })
      .populate({ path: "surveyerUserId", select: "name email surveyerId" });

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    const isOwner =
      report.surveyerUserId &&
      report.surveyerUserId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You do not have permission to view this report",
      });
    }

    return res.status(200).json({
      report,
    });
  } catch (error) {
    console.error("Get report by ID error:", error);
    return res.status(500).json({
      message: "Server error while fetching report",
    });
  }
};

module.exports = {
  generateReport,
  submitReport,
  getMyReports,
  getReportById,
};