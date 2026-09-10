const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    option: {
      type: String,
      required: true,
    },

    count: {
      type: Number,
      required: true,
      min: 0,
    },

    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  {
    _id: false,
  }
);

const analyticsSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
    },

    question: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      required: true,
    },

    average: {
      type: Number,
      default: null,
    },

    results: {
      type: [resultSchema],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const reportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
    },

    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
      unique: true,
    },

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
    },

    surveyerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    surveyerId: {
      type: String,
      required: true,
    },

    totalResponses: {
      type: Number,
      default: 0,
      min: 0,
    },

    analytics: {
      type: [analyticsSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED"],
      default: "DRAFT",
    },

    pdfUrl: {
      type: String,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Report", reportSchema);