const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    type: {
      type: String,
      enum: [
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "YES_NO",
        "RATING",
      ],
      required: true,
    },

    options: {
      type: [optionSchema],
      default: [],
    },

    required: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const surveySchema = new mongoose.Schema(
  {
    surveyId: {
      type: String,
      required: true,
      unique: true,
    },

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      unique: true,
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

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    questions: {
      type: [questionSchema],
      default: [],
    },

    location: {
      city: {
        type: String,
        required: true,
        trim: true,
      },

      latitude: {
        type: Number,
        required: true,
      },

      longitude: {
        type: Number,
        required: true,
      },

      radius: {
        type: Number,
        required: true,
        min: 1,
        max: 100,
      },
    },

    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "COMPLETED"],
      default: "DRAFT",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Survey", surveySchema);