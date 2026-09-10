const Survey = require("../models/Survey");

const generateSurveyId = async () => {
  const surveys = await Survey.find({})
    .select("surveyId")
    .lean();

  let maxNumber = 0;

  for (const survey of surveys) {
    const match = survey.surveyId.match(/^SURV(\d+)$/);

    if (match) {
      maxNumber = Math.max(
        maxNumber,
        parseInt(match[1], 10)
      );
    }
  }

  return `SURV${String(maxNumber + 1).padStart(4, "0")}`;
};

module.exports = generateSurveyId;