const Report = require("../models/Report");

const generateReportId = async () => {
  const reports = await Report.find({})
    .select("reportId")
    .lean();

  let maxNumber = 0;

  for (const report of reports) {
    const match = report.reportId.match(/^REP(\d+)$/);

    if (match) {
      maxNumber = Math.max(
        maxNumber,
        parseInt(match[1], 10)
      );
    }
  }

  return `REP${String(maxNumber + 1).padStart(4, "0")}`;
};

module.exports = generateReportId;