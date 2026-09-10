const { z } = require("zod");

const submitResponseSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),

        answer: z.any(),
      })
    )
    .min(1, "At least one answer is required"),
});

module.exports = {
  submitResponseSchema,
};