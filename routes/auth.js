const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { userQueries, sessionQueries } = require('../models/db');
const { protect } = require('../middleware/auth');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('name').optional().trim(),
    body('email').optional().isEmail().withMessage('Valid email required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { phoneNumber, name, email, subscriptionTier } = req.body;

      // Check if user exists
      const existingUser = await userQueries.findByPhoneNumber(phoneNumber);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this phone number',
        });
      }

      // Create user
      const user = await userQueries.createUser({
        phoneNumber,
        name,
        email,
        subscriptionTier: subscriptionTier || null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Create session log
      await sessionQueries.createSession(
        user.id,
        req.ip,
        req.headers['user-agent']
      );

      // Generate token
      const token = generateToken(user.id);

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          name: user.name,
          email: user.email,
          subscriptionTier: user.subscription_tier,
          createdAt: user.created_at,
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration',
      });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [body('phoneNumber').notEmpty().withMessage('Phone number is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { phoneNumber } = req.body;

      // Find user
      const user = await userQueries.findByPhoneNumber(phoneNumber);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // Update login info
      await userQueries.updateLogin(
        user.id,
        req.ip,
        req.headers['user-agent']
      );

      // Create session log
      const session = await sessionQueries.createSession(
        user.id,
        req.ip,
        req.headers['user-agent']
      );

      // Store session ID in token payload for logout tracking
      const token = jwt.sign(
        { id: user.id, sessionId: session.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      // Get updated user data
      const updatedUser = await userQueries.findById(user.id);

      res.json({
        success: true,
        token,
        user: {
          id: updatedUser.id,
          phoneNumber: updatedUser.phone_number,
          name: updatedUser.name,
          email: updatedUser.email,
          subscriptionTier: updatedUser.subscription_tier,
          avatar: updatedUser.avatar,
          company: updatedUser.company,
          createdAt: updatedUser.created_at,
          usage: {
            agentsCreated: updatedUser.agents_created,
            episodesRun: updatedUser.episodes_run,
            interactionsThisMonth: updatedUser.interactions_this_month,
            templatesCreated: updatedUser.templates_created,
            intentsCreated: updatedUser.intents_created,
          },
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login',
      });
    }
  }
);

// @route   POST /api/auth/logout
// @desc    Logout user and save session data
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    const user = req.user;

    // Calculate session duration
    const sessionStart = new Date(user.last_login);
    const sessionEnd = new Date();
    const duration = Math.floor((sessionEnd - sessionStart) / 1000); // in seconds

    // Update user logout
    await userQueries.updateLogout(user.id, duration);

    // Update session log if sessionId is in token
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.sessionId) {
      await sessionQueries.updateSessionLogout(decoded.sessionId, duration);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
      sessionDuration: duration,
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        name: user.name,
        email: user.email,
        subscriptionTier: user.subscription_tier,
        subscriptionStatus: user.subscription_status,
        avatar: user.avatar,
        company: user.company,
        createdAt: user.created_at,
        usage: {
          agentsCreated: user.agents_created,
          episodesRun: user.episodes_run,
          interactionsThisMonth: user.interactions_this_month,
          templatesCreated: user.templates_created,
          intentsCreated: user.intents_created,
        },
        lastLogin: user.last_login,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;