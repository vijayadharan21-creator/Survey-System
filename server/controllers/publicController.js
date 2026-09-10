/**
 * publicController.js
 *
 * Public survey endpoints — no authentication required.
 * Anyone with the link can view and respond to a PUBLISHED survey.
 */
const Survey   = require('../models/Survey');
const Response = require('../models/Response');

/* ─── GET /api/public/surveys/:surveyId ─────────────────────────────
   Returns the survey questions (by human-readable surveyId string).
   Only works while the survey is PUBLISHED and within its time window.
─────────────────────────────────────────────────────────────────── */
const getPublicSurvey = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const survey = await Survey.findOne({ surveyId }).lean();

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found. Please check the link.' });
    }

    const now = new Date();

    if (survey.status === 'DRAFT') {
      return res.status(400).json({ message: 'This survey has not been published yet. Please check back later.' });
    }

    if (survey.status === 'COMPLETED') {
      return res.status(400).json({ message: 'This survey has ended and is no longer accepting responses.' });
    }

    if (survey.status !== 'PUBLISHED') {
      return res.status(400).json({ message: 'This survey is not currently available.' });
    }

    if (now < new Date(survey.startTime)) {
      return res.status(400).json({
        message: `This survey hasn't started yet. It opens on ${new Date(survey.startTime).toLocaleString('en-IN')}.`,
      });
    }

    if (now > new Date(survey.endTime)) {
      return res.status(400).json({ message: 'This survey has closed and is no longer accepting responses.' });
    }

    return res.status(200).json({
      survey: {
        surveyId:    survey.surveyId,
        title:       survey.title,
        description: survey.description,
        questions:   survey.questions,
        location:    survey.location.city,
        startTime:   survey.startTime,
        endTime:     survey.endTime,
      },
    });
  } catch (err) {
    console.error('getPublicSurvey error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ─── POST /api/public/surveys/:surveyId/respond ─────────────────────
   Accepts a response from any visitor (no login required).
   Geolocation is optional for public responses.
─────────────────────────────────────────────────────────────────── */
const submitPublicResponse = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { answers, respondentName } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'Answers are required.' });
    }

    const survey = await Survey.findOne({ surveyId });

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found.' });
    }

    const now = new Date();

    if (survey.status !== 'PUBLISHED' || now < new Date(survey.startTime) || now > new Date(survey.endTime)) {
      return res.status(400).json({ message: 'This survey is no longer accepting responses.' });
    }

    // Validate each answer against its question
    for (const answer of answers) {
      if (!answer.questionId || answer.answer === undefined || answer.answer === null) {
        return res.status(400).json({ message: 'Each answer must include questionId and answer.' });
      }
    }

    await Response.create({
      surveyId:       survey._id,
      userId:         null,
      isPublic:       true,
      respondentName: respondentName || 'Anonymous',
      answers,
    });

    return res.status(201).json({ message: 'Thank you! Your response has been recorded.' });
  } catch (err) {
    console.error('submitPublicResponse error:', err);
    return res.status(500).json({ message: 'Server error while submitting response.' });
  }
};

/* ─── GET /api/public/surveys/all ──────────────────────────────────────
   Lists all currently active PUBLISHED surveys. Optional ?city= filter.
─────────────────────────────────────────────────────── */
const getAllPublicSurveys = async (req, res) => {
  try {
    const { city } = req.query;
    const now = new Date();

    const query = {
      status:    'PUBLISHED',
      startTime: { $lte: now },
      endTime:   { $gte: now },
    };

    // Optional server-side city filter
    if (city) {
      query['location.city'] = { $regex: city, $options: 'i' };
    }

    const surveys = await Survey.find(query)
      .select('surveyId title description location startTime endTime questions')
      .lean();

    return res.status(200).json({ surveys });
  } catch (err) {
    console.error('getAllPublicSurveys error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getPublicSurvey, submitPublicResponse, getAllPublicSurveys };
