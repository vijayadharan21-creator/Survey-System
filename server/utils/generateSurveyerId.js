const User = require("../models/User");

const CITY_CODES = {
  madurai: "MDU",
  chennai: "CHN",
  coimbatore: "CBE",
  trichy: "TRY",
  tirunelveli: "TNV",
};

const createCityCode = (city) => {
  const normalizedCity = city.trim().toLowerCase();

  return CITY_CODES[normalizedCity] || "GEN";
};

const generateSurveyerId = async (city) => {
  const cityCode = createCityCode(city);

  const users = await User.find({
    surveyerId: {
      $regex: `^SURVEY${cityCode}\\d+$`,
    },
  })
    .select("surveyerId")
    .lean();

  let maxNumber = 0;

  for (const user of users) {
    const match = user.surveyerId.match(/(\d+)$/);

    if (match) {
      maxNumber = Math.max(
        maxNumber,
        parseInt(match[1], 10)
      );
    }
  }

  const nextNumber = String(maxNumber + 1).padStart(2, "0");

  return `SURVEY${cityCode}${nextNumber}`;
};

module.exports = generateSurveyerId;