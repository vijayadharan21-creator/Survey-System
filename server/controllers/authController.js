const bcrypt = require("bcryptjs");

const User = require("../models/User");
const {
  registerSchema,
  loginSchema,
} = require("../Validators/authValidator");

const generateToken = require("../utils/generateToken");

const register = async (req, res) => {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.issues,
      });
    }

    const { name, email, password } = result.data;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "USER",
    });

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Server error during registration",
    });
  }
};

const login = async (req, res) => {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.issues,
      });
    }

    const { loginId, password } = result.data;

    // Find by email OR Surveyer ID
    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase() },
        { surveyerId: loginId.toUpperCase() },
      ],
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // Surveyer ID can only be used while authorization is ACTIVE
    if (
      user.role === "USER" &&
      user.surveyerId &&
      user.surveyerStatus === "COMPLETED" &&
      loginId.toUpperCase() === user.surveyerId.toUpperCase()
    ) {
      return res.status(401).json({
        message: "This Surveyer ID is no longer active",
      });
    }

    // More direct protection for an invalidated Surveyer
    if (
      user.surveyerId &&
      loginId.toUpperCase() === user.surveyerId.toUpperCase() &&
      user.surveyerStatus !== "ACTIVE"
    ) {
      return res.status(401).json({
        message: "This Surveyer ID is no longer active",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message: "Please log in using Google OAuth",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // If currently SURVEYER, check if current active survey/proposal already has a report
    if (user.role === "SURVEYER") {
      const Report = require("../models/Report");
      let activeReport = null;
      if (user.surveyId) {
        activeReport = await Report.findOne({ surveyId: user.surveyId });
      } else if (user.proposalId) {
        activeReport = await Report.findOne({ proposalId: user.proposalId });
      }
      if (activeReport) {
        user.role = "USER";
        user.surveyerStatus = "COMPLETED";
        await user.save();
      }
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
        surveyerId: user.surveyerId,
        surveyerStatus: user.surveyerStatus,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Server error during login",
    });
  }
};

// ── GET /api/auth/profile ───────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // If currently SURVEYER, check if current active survey/proposal already has a report
    if (user.role === "SURVEYER") {
      const Report = require("../models/Report");
      let activeReport = null;
      if (user.surveyId) {
        activeReport = await Report.findOne({ surveyId: user.surveyId });
      } else if (user.proposalId) {
        activeReport = await Report.findOne({ proposalId: user.proposalId });
      }
      if (activeReport) {
        user.role = "USER";
        user.surveyerStatus = "COMPLETED";
        await user.save();
      }
    }

    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;

    return res.status(200).json({ user: sanitizedUser });
  } catch (err) {
    console.error('getProfile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

// ── PUT /api/auth/profile ────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (name && name.trim().length >= 2) {
      user.name = name.trim();
    }

    if (newPassword) {
      if (!currentPassword)
        return res.status(400).json({ message: 'Current password is required to set a new password.' });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid)
        return res.status(400).json({ message: 'Current password is incorrect.' });
      if (newPassword.length < 8)
        return res.status(400).json({ message: 'New password must be at least 8 characters.' });
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        _id:           user._id,
        name:          user.name,
        email:         user.email,
        role:          user.role,
        surveyerId:    user.surveyerId,
        surveyerStatus:user.surveyerStatus,
      },
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { register, login, getProfile, updateProfile };