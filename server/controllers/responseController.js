const mongoose = require("mongoose");

const Response = require("../models/Response");
const Survey = require("../models/Survey");

const calculateDistance = require("../utils/distance");

const {
  submitResponseSchema,
} = require("../Validators/responseValidator");

const submitResponse = async (req, res) => {
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
          "Your location is required to submit this survey",
      });
    }

    const validation =
      submitResponseSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Invalid response data",
        errors: validation.error.issues,
      });
    }

    const survey = await Survey.findById(id);

    if (!survey) {
      return res.status(404).json({
        message: "Survey not found",
      });
    }

    // Check whether survey is currently active
    const now = new Date();

    if (
      survey.status !== "PUBLISHED" ||
      now < new Date(survey.startTime) ||
      now > new Date(survey.endTime)
    ) {
      return res.status(400).json({
        message: "This survey is not currently active",
      });
    }

    // Check location
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

    // Check duplicate response
    const existingResponse = await Response.findOne({
      surveyId: survey._id,
      userId: req.user._id,
    });

    if (existingResponse) {
      return res.status(409).json({
        message:
          "You have already submitted a response to this survey",
      });
    }

    // Validate answers against survey questions
    const submittedAnswers = validation.data.answers;

    const questionMap = new Map(
      survey.questions.map((question) => [
        question.questionId,
        question,
      ])
    );

    const submittedQuestionIds = new Set();

    for (const item of submittedAnswers) {
      if (submittedQuestionIds.has(item.questionId)) {
        return res.status(400).json({
          message: `Duplicate answer for question ${item.questionId}`,
        });
      }

      submittedQuestionIds.add(item.questionId);

      const question = questionMap.get(
        item.questionId
      );

      if (!question) {
        return res.status(400).json({
          message: `Invalid question ID: ${item.questionId}`,
        });
      }

      // Validate choice answers
      if (
        question.type === "SINGLE_CHOICE" ||
        question.type === "YES_NO"
      ) {
        if (typeof item.answer !== "string") {
          return res.status(400).json({
            message: `Invalid answer for ${item.questionId}`,
          });
        }

        if (question.type === "YES_NO") {
          if (!["Yes", "No"].includes(item.answer)) {
            return res.status(400).json({
              message: `Invalid Yes/No answer for ${item.questionId}`,
            });
          }
        } else {
          const validOption = question.options.some(
            (option) => option.text === item.answer
          );

          if (!validOption) {
            return res.status(400).json({
              message: `Invalid option for ${item.questionId}`,
            });
          }
        }
      }

      // Validate multiple choice
      if (
        question.type === "MULTIPLE_CHOICE"
      ) {
        if (!Array.isArray(item.answer)) {
          return res.status(400).json({
            message: `Multiple-choice answer must be an array for ${item.questionId}`,
          });
        }

        const validOptions =
          question.options.map(
            (option) => option.text
          );

        const allValid = item.answer.every(
          (answer) =>
            typeof answer === "string" &&
            validOptions.includes(answer)
        );

        if (!allValid) {
          return res.status(400).json({
            message: `Invalid option for ${item.questionId}`,
          });
        }
      }

      // Validate rating
      if (question.type === "RATING") {
        const rating = Number(item.answer);

        if (
          !Number.isInteger(rating) ||
          rating < 1 ||
          rating > 5
        ) {
          return res.status(400).json({
            message:
              `Rating must be between 1 and 5 for ${item.questionId}`,
          });
        }
      }
    }

    // Required questions
    for (const question of survey.questions) {
      if (
        question.required &&
        !submittedQuestionIds.has(
          question.questionId
        )
      ) {
        return res.status(400).json({
          message:
            `Question ${question.questionId} is required`,
        });
      }
    }

    // Create response
    const response = await Response.create({
      surveyId: survey._id,
      userId: req.user._id,
      answers: submittedAnswers,
    });

    return res.status(201).json({
      message:
        "Survey response submitted successfully",

      responseId: response._id,
    });
  } catch (error) {
    console.error(
      "Submit response error:",
      error
    );

    // MongoDB unique constraint
    if (
      error instanceof mongoose.Error &&
      error.code === 11000
    ) {
      return res.status(409).json({
        message:
          "You have already submitted a response to this survey",
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "You have already submitted a response to this survey",
      });
    }

    return res.status(500).json({
      message:
        "Server error while submitting response",
    });
  }
};

module.exports = {
  submitResponse,
};