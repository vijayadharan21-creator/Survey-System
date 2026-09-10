const Proposal = require("../models/Proposal");

const updateSurveyStatus = async (survey) => {
  const now = new Date();

  if (
    survey.status === "PUBLISHED" &&
    survey.endTime &&
    now > new Date(survey.endTime)
  ) {
    survey.status = "COMPLETED";
    await survey.save();

    if (survey.proposalId) {
      try {
        await Proposal.findByIdAndUpdate(survey.proposalId, { status: "COMPLETED" });
      } catch (err) {
        console.error("Failed to update proposal status on survey completion:", err.message);
      }
    }
  }

  return survey;
};

module.exports = updateSurveyStatus;