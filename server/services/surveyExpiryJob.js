/**
 * surveyExpiryJob.js
 *
 * Runs every minute. Finds all PUBLISHED surveys whose endTime has passed,
 * marks them COMPLETED, then automatically reverts the owner's role from
 * SURVEYER → USER (surveyerStatus → COMPLETED).
 *
 * This means the SURVEYER role is time-bounded:
 *   Survey end time passes → role reverts to USER automatically,
 *   regardless of whether the surveyer manually submits a report.
 */

const cron = require('node-cron');
const Survey = require('../models/Survey');
const User   = require('../models/User');
const Notification = require('../models/Notification');

async function expireSurveys() {
  const now = new Date();

  // Find all PUBLISHED surveys whose end time has passed
  const expiredSurveys = await Survey.find({
    status:  'PUBLISHED',
    endTime: { $lte: now },
  });

  if (expiredSurveys.length === 0) return;

  for (const survey of expiredSurveys) {
    try {
      // 1. Mark survey COMPLETED
      survey.status = 'COMPLETED';
      await survey.save();

      // Mark associated proposal as COMPLETED
      if (survey.proposalId) {
        const Proposal = require('../models/Proposal');
        await Proposal.findByIdAndUpdate(survey.proposalId, { status: 'COMPLETED' });
      }

      // 2. Find the owner and revert role to USER
      const owner = await User.findById(survey.surveyerUserId);

      if (!owner || owner.role !== 'SURVEYER') continue;

      const previousSurveyerId = owner.surveyerId;
      owner.role           = 'USER';
      owner.surveyerStatus = 'COMPLETED';
      await owner.save();

      // 3. Create an in-app notification for the owner
      await Notification.create({
        userId:  owner._id,
        title:   'Survey Completed — Role Reverted',
        message: `Your survey "${survey.title}" (${survey.surveyId}) has ended. `
               + `Your Surveyer authorization (ID: ${previousSurveyerId}) has been completed. `
               + `Your role has been automatically reverted to USER. `
               + `Please log out and log back in to continue as a regular user.`,
        type:    'SURVEY_COMPLETED',
        isRead:  false,
      });

      console.log(
        `[SurveyExpiryJob] Survey "${survey.surveyId}" expired → COMPLETED. `
        + `Owner ${owner.email} role → USER.`
      );
    } catch (err) {
      console.error(
        `[SurveyExpiryJob] Error processing survey ${survey.surveyId}:`,
        err.message
      );
    }
  }
}

function startSurveyExpiryJob() {
  // Run every minute: '* * * * *'
  cron.schedule('* * * * *', async () => {
    try {
      await expireSurveys();
    } catch (err) {
      console.error('[SurveyExpiryJob] Unexpected error:', err.message);
    }
  });

  console.log('[SurveyExpiryJob] ✅ Survey expiry job started — checks every minute.');
}

module.exports = { startSurveyExpiryJob };
