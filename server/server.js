require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { startSurveyExpiryJob } = require("./services/surveyExpiryJob");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Start the survey expiry cron job (checks every minute)
  startSurveyExpiryJob();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();