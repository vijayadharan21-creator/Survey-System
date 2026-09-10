const validateSurveyForPublish = (survey) => {
  if (!survey.title?.trim()) {
    return "Survey title is required";
  }

  if (!survey.description?.trim()) {
    return "Survey description is required";
  }

  if (!survey.questions || survey.questions.length === 0) {
    return "At least one question is required";
  }

  for (const question of survey.questions) {
    if (!question.text?.trim()) {
      return "Every question must have text";
    }

    if (
      ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(
        question.type
      ) &&
      question.options.length < 2
    ) {
      return "Choice questions must have at least 2 options";
    }
  }

  if (!survey.location?.city) {
    return "Survey location is required";
  }

  if (
    survey.location.latitude === undefined ||
    survey.location.longitude === undefined
  ) {
    return "Survey coordinates are required";
  }

  if (!survey.startTime || !survey.endTime) {
    return "Start and end date/time are required";
  }

  const startTime = new Date(survey.startTime);
  const endTime = new Date(survey.endTime);
  const now = new Date();
  const nowBuffer = new Date(Date.now() - 2 * 60 * 1000);

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return "Please provide valid start and end dates/times";
  }

  // Publish / start time should not be in the past
  if (startTime < nowBuffer) {
    return "Publish / start time cannot be in the past";
  }

  // End time must be in the future
  if (endTime <= now) {
    return "End date and time must be in the future";
  }

  // Compare both date and time
  if (endTime <= startTime) {
    return "End time must be after start time (comparing both date and time)";
  }

  return null;
};

module.exports = validateSurveyForPublish;