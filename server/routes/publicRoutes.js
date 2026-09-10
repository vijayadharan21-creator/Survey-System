const express = require('express');
const { getPublicSurvey, submitPublicResponse, getAllPublicSurveys } = require('../controllers/publicController');

const router = express.Router();

// IMPORTANT: /surveys/all must be registered BEFORE /surveys/:surveyId
router.get('/surveys/all',                  getAllPublicSurveys);
router.get('/surveys/:surveyId',            getPublicSurvey);
router.post('/surveys/:surveyId/respond',   submitPublicResponse);

module.exports = router;
