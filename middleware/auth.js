const jwt = require('jsonwebtoken');
const { userQueries } = require('../models/db');

exports.protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await userQueries.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Check subscription tier
exports.checkTier = (...allowedTiers) => {
  return (req, res, next) => {
    if (!req.user.subscription_tier || !allowedTiers.includes(req.user.subscription_tier)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires ${allowedTiers.join(' or ')} subscription`,
      });
    }
    next();
  };
};