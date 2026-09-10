const { z } = require("zod");

const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must contain at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .trim(),

  email: z
    .string()
    .email("Please provide a valid email")
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(6, "Password must contain at least 6 characters"),
});

const loginSchema = z.object({
  loginId: z
    .string()
    .min(1, "Email or Surveyer ID is required")
    .trim(),

  password: z
    .string()
    .min(1, "Password is required"),
});

module.exports = {
  registerSchema,
  loginSchema,
};