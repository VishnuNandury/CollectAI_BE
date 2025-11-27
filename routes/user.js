const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { userQueries, usageQueries } = require('../models/db');
const { protect, checkTier } = require('../middleware/auth');

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put(
  '/profile',
  protect,
  [
    body('name').optional().trim(),
    body('email').optional().isEmail(),
    body('company').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, company, avatar } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (company !== undefined) updates.company = company;
      if (avatar !== undefined) updates.avatar = avatar;

      const user = await userQueries.updateProfile(req.user.id, updates);

      res.json({
        success: true,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          name: user.name,
          email: user.email,
          company: user.company,
          avatar: user.avatar,
          subscriptionTier: user.subscription_tier,
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  }
);

// @route   POST /api/user/usage
// @desc    Track user usage
// @access  Private
router.post('/usage', protect, async (req, res) => {
  try {
    const { action, count = 1, metadata } = req.body;

    // Update user usage counters
    const usage = await userQueries.updateUsage(req.user.id, action, count);

    // Log detailed usage
    await usageQueries.logUsage(req.user.id, action, count, metadata);

    res.json({
      success: true,
      usage: {
        agentsCreated: usage.agents_created,
        episodesRun: usage.episodes_run,
        interactionsThisMonth: usage.interactions_this_month,
        templatesCreated: usage.templates_created,
        intentsCreated: usage.intents_created,
      },
    });
  } catch (error) {
    console.error('Track usage error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

// @route   GET /api/user/limits
// @desc    Get user subscription limits
// @access  Private
router.get('/limits', protect, async (req, res) => {
  try {
    const user = req.user;

    const LIMITS = {
      starter: {
        maxAgents: 1,
        maxEpisodes: 100,
        maxInteractions: 1000,
        maxTemplates: 3,
        maxIntents: 5,
        hasKnowledgeGraph: false,
        canEditKnowledgeGraph: false,
        hasAPIAccess: false,
      },
      professional: {
        maxAgents: 5,
        maxEpisodes: null,
        maxInteractions: 10000,
        maxTemplates: null,
        maxIntents: 20,
        hasKnowledgeGraph: true,
        canEditKnowledgeGraph: false,
        hasAPIAccess: false,
      },
      enterprise: {
        maxAgents: null,
        maxEpisodes: null,
        maxInteractions: null,
        maxTemplates: null,
        maxIntents: null,
        hasKnowledgeGraph: true,
        canEditKnowledgeGraph: true,
        hasAPIAccess: true,
      },
    };

    const limits = user.subscription_tier
      ? LIMITS[user.subscription_tier]
      : LIMITS.starter;

    res.json({
      success: true,
      tier: user.subscription_tier || 'free',
      limits,
      currentUsage: {
        agentsCreated: user.agents_created,
        episodesRun: user.episodes_run,
        interactionsThisMonth: user.interactions_this_month,
        templatesCreated: user.templates_created,
        intentsCreated: user.intents_created,
      },
    });
  } catch (error) {
    console.error('Get limits error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   PUT /api/user/subscription
// @desc    Update subscription tier
// @access  Private
router.put('/subscription', protect, async (req, res) => {
  try {
    const { tier } = req.body;

    if (!['starter', 'professional', 'enterprise'].includes(tier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription tier',
      });
    }

    const subscription = await userQueries.updateSubscription(req.user.id, tier);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: {
        subscriptionTier: subscription.subscription_tier,
        subscriptionStatus: subscription.subscription_status,
        subscriptionStartDate: subscription.subscription_start_date,
        subscriptionEndDate: subscription.subscription_end_date,
      },
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/user/sessions
// @desc    Get user session history
// @access  Private
router.get('/sessions', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sessions = await sessionQueries.getUserSessions(req.user.id, limit);

    res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// @route   GET /api/user/usage-logs
// @desc    Get user usage logs
// @access  Private
router.get('/usage-logs', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await usageQueries.getUserUsage(req.user.id, limit);

    res.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error('Get usage logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;