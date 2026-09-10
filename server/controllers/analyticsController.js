const Survey = require("../models/Survey");
const Response = require("../models/Response");
const updateSurveyStatus = require("../utils/updateSurveyStatus");

const getSurveyAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const survey = await Survey.findById(id);

    if (!survey) {
      return res.status(404).json({
        message: "Survey not found",
      });
    }

    await updateSurveyStatus(survey);

    // Only the Surveyer who owns the survey or Admin can view analytics
    const isOwner =
      req.user.role === "SURVEYER" &&
      survey.surveyerUserId.toString() === req.user._id.toString();

    const isAdmin = req.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You do not have permission to view analytics",
      });
    }

    const responses = await Response.find({
      surveyId: survey._id,
    }).lean();

    const totalResponses = responses.length;

    // ── 1. Engagement & Demographics Metrics ───────────────────
    let anonymousCount = 0;
    let authenticatedCount = 0;
    let totalQuestionsAnswered = 0;
    const timelineMap = {};

    responses.forEach((resp) => {
      if (resp.isPublic || !resp.userId) {
        anonymousCount++;
      } else {
        authenticatedCount++;
      }

      totalQuestionsAnswered += Array.isArray(resp.answers) ? resp.answers.length : 0;

      // Group by date (YYYY-MM-DD)
      const dateKey = new Date(resp.createdAt || Date.now()).toISOString().split("T")[0];
      timelineMap[dateKey] = (timelineMap[dateKey] || 0) + 1;
    });

    const expectedTotalAnswers = totalResponses * (survey.questions?.length || 1);
    const completionRate =
      expectedTotalAnswers === 0
        ? 0
        : Number(((totalQuestionsAnswered / expectedTotalAnswers) * 100).toFixed(1));

    const timeline = Object.entries(timelineMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // ── 2. Per-Question Detailed Analytics ───────────────────────
    let totalRatingSum = 0;
    let totalRatingCount = 0;
    let highestRatingQ = null;
    let highestRatingVal = -1;

    const analytics = survey.questions.map((question) => {
      const questionResponses = responses
        .map((response) =>
          response.answers.find((answer) => answer.questionId === question.questionId)
        )
        .filter(Boolean);

      const answeredCount = questionResponses.length;

      // ── SINGLE CHOICE / YES_NO ────────────────────────────────
      if (question.type === "SINGLE_CHOICE" || question.type === "YES_NO") {
        const counts = {};
        const options =
          question.type === "YES_NO"
            ? ["Yes", "No"]
            : question.options.map((option) => option.text);

        options.forEach((option) => {
          counts[option] = 0;
        });

        questionResponses.forEach((item) => {
          if (counts[item.answer] !== undefined) {
            counts[item.answer]++;
          }
        });

        let topChoice = null;
        let maxCount = -1;

        const results = options.map((option) => {
          const count = counts[option];
          if (count > maxCount) {
            maxCount = count;
            topChoice = { option, count };
          }
          return {
            option,
            count,
            percentage:
              totalResponses === 0
                ? 0
                : Number(((count / totalResponses) * 100).toFixed(1)),
          };
        });

        // Compute sentiment for YES_NO
        let sentiment = null;
        if (question.type === "YES_NO") {
          const yesPct = results.find((r) => r.option === "Yes")?.percentage || 0;
          sentiment = {
            yesPercentage: yesPct,
            noPercentage: Number((100 - yesPct).toFixed(1)),
            label: yesPct >= 65 ? "Strongly Favorable" : yesPct >= 45 ? "Balanced" : "Critical / Unfavorable",
          };
        }

        return {
          questionId: question.questionId,
          question: question.text,
          type: question.type,
          answeredCount,
          topChoice: topChoice ? { ...topChoice, percentage: totalResponses > 0 ? Number(((topChoice.count / totalResponses) * 100).toFixed(1)) : 0 } : null,
          sentiment,
          results,
        };
      }

      // ── MULTIPLE CHOICE ───────────────────────────────────────
      if (question.type === "MULTIPLE_CHOICE") {
        const counts = {};

        question.options.forEach((option) => {
          counts[option.text] = 0;
        });

        let totalSelections = 0;
        questionResponses.forEach((item) => {
          if (Array.isArray(item.answer)) {
            item.answer.forEach((answer) => {
              if (counts[answer] !== undefined) {
                counts[answer]++;
                totalSelections++;
              }
            });
          }
        });

        let topChoice = null;
        let maxCount = -1;

        const results = question.options.map((option) => {
          const count = counts[option.text];
          if (count > maxCount) {
            maxCount = count;
            topChoice = { option: option.text, count };
          }
          return {
            option: option.text,
            count,
            percentage:
              totalResponses === 0
                ? 0
                : Number(((count / totalResponses) * 100).toFixed(1)),
          };
        });

        return {
          questionId: question.questionId,
          question: question.text,
          type: question.type,
          answeredCount,
          totalSelections,
          topChoice: topChoice ? { ...topChoice, percentage: totalResponses > 0 ? Number(((topChoice.count / totalResponses) * 100).toFixed(1)) : 0 } : null,
          results,
        };
      }

      // ── RATING ───────────────────────────────────────────────
      if (question.type === "RATING") {
        const ratings = questionResponses
          .map((item) => Number(item.answer))
          .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);

        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let sum = 0;

        ratings.forEach((rating) => {
          counts[rating]++;
          sum += rating;
        });

        const countTotal = ratings.length;
        const average = countTotal === 0 ? 0 : Number((sum / countTotal).toFixed(2));

        if (average > highestRatingVal && countTotal > 0) {
          highestRatingVal = average;
          highestRatingQ = question.text;
        }

        totalRatingSum += sum;
        totalRatingCount += countTotal;

        // CSAT calculation: % of 4 and 5 stars
        const positiveCount = counts[4] + counts[5];
        const neutralCount = counts[3];
        const negativeCount = counts[1] + counts[2];

        const csat = countTotal === 0 ? 0 : Number(((positiveCount / countTotal) * 100).toFixed(1));

        const sentiment = {
          positivePercentage: countTotal === 0 ? 0 : Number(((positiveCount / countTotal) * 100).toFixed(1)),
          neutralPercentage: countTotal === 0 ? 0 : Number(((neutralCount / countTotal) * 100).toFixed(1)),
          negativePercentage: countTotal === 0 ? 0 : Number(((negativeCount / countTotal) * 100).toFixed(1)),
          ratingHealth: average >= 4 ? "Excellent" : average >= 3 ? "Moderate" : "Needs Attention",
        };

        const results = Object.entries(counts).map(([rating, count]) => ({
          rating: Number(rating),
          count,
          percentage:
            countTotal === 0 ? 0 : Number(((count / countTotal) * 100).toFixed(1)),
        }));

        return {
          questionId: question.questionId,
          question: question.text,
          type: question.type,
          answeredCount,
          average,
          csat,
          sentiment,
          results,
        };
      }

      return {
        questionId: question.questionId,
        question: question.text,
        type: question.type,
        answeredCount,
        results: [],
      };
    });

    // Overall metrics
    const overallAverageRating =
      totalRatingCount === 0 ? null : Number((totalRatingSum / totalRatingCount).toFixed(2));

    const overallInsights = {
      overallAverageRating,
      highestRatingQuestion: highestRatingQ,
      highestRatingValue: highestRatingVal >= 0 ? highestRatingVal : null,
      completionRate,
      anonymousPercentage: totalResponses > 0 ? Number(((anonymousCount / totalResponses) * 100).toFixed(1)) : 0,
      authenticatedPercentage: totalResponses > 0 ? Number(((authenticatedCount / totalResponses) * 100).toFixed(1)) : 0,
    };

    return res.status(200).json({
      survey: {
        id: survey._id,
        surveyId: survey.surveyId,
        title: survey.title,
        status: survey.status,
        startTime: survey.startTime,
        endTime: survey.endTime,
        location: survey.location,
      },
      totalResponses,
      anonymousCount,
      authenticatedCount,
      completionRate,
      timeline,
      overallInsights,
      analytics,
    });
  } catch (error) {
    console.error("Get survey analytics error:", error);

    return res.status(500).json({
      message: "Server error while generating survey analytics",
    });
  }
};

module.exports = {
  getSurveyAnalytics,
};