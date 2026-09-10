const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
    },

    answer: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const responseSchema = new mongoose.Schema(
  {
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,   // null for anonymous public responses
      default: null,
    },

    respondentName: {
      type: String,
      default: 'Anonymous',
    },

    isPublic: {
      type: Boolean,
      default: false,
    },

    answers: {
      type: [answerSchema],
      required: true,
      validate: {
        validator: (answers) => answers.length > 0,
        message: "At least one answer is required",
      },
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Only enforce one response per user per survey for authenticated users
responseSchema.index(
  { surveyId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  }
);



module.exports = mongoose.model(
  "Response",
  responseSchema
);