const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: false,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      default: undefined,
    },

    avatar: {
      type: String,
      default: null,
    },

    authProvider: {
      type: String,
      enum: ["LOCAL", "GOOGLE"],
      default: "LOCAL",
    },

    role: {
      type: String,
      enum: ["USER", "SURVEYER", "ADMIN"],
      default: "USER",
    },

    surveyerId: {
      type: String,
      default: undefined,
    },

    surveyerStatus: {
      type: String,
      enum: ["ACTIVE", "COMPLETED"],
      default: null,
    },

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
    },

    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index(
  { surveyerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      surveyerId: {
        $type: "string",
      },
    },
  }
);

module.exports = mongoose.model("User", userSchema);