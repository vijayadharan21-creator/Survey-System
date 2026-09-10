const express = require("express");
const cors = require("cors");

const authRoutes     = require("./routes/authRoutes");
const proposalRoutes = require("./routes/proposalRoutes");
const adminRoutes    = require("./routes/adminRoutes");
const surveyRoutes   = require("./routes/surveyRoutes");
const responseRoutes = require("./routes/responseRoutes");
const analyticsRoutes= require("./routes/analyticsRoutes");
const reportRoutes   = require("./routes/reportRoutes");
const publicRoutes   = require("./routes/publicRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth",     authRoutes);
app.use("/api",         responseRoutes);
app.use("/api/proposals",proposalRoutes);
app.use("/api/admin",   adminRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api",         analyticsRoutes);
app.use("/api",         reportRoutes);
app.use("/api/public",  publicRoutes);   // no-auth public survey link

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Survey System API is running",
  });
});

module.exports = app;