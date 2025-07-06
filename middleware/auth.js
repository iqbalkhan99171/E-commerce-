const jwt = require('jsonwebtoken');
const { getRow } = require('../database/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer token

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

// Check if user is Super Admin
const isSuperAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Super Admin only.' 
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server error.' 
    });
  }
};

// Check if user is Client
const isClient = async (req, res, next) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Client only.' 
      });
    }

    // Check if client is approved and has active subscription
    const client = await getRow(
      'SELECT u.*, cs.status as subscription_status, cs.end_date FROM users u LEFT JOIN client_subscriptions cs ON u.id = cs.client_id WHERE u.id = ? AND cs.status = "active" ORDER BY cs.created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (!client) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. No active subscription found.' 
      });
    }

    if (client.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Account pending approval.' 
      });
    }

    // Check if subscription is expired
    const currentDate = new Date().toISOString().split('T')[0];
    if (client.end_date < currentDate) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Subscription expired. Please renew your plan.' 
      });
    }

    req.client = client;
    next();
  } catch (error) {
    console.error('Client auth error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error.' 
    });
  }
};

// Check if user is either Super Admin or Client (for shared endpoints)
const isAuthenticated = async (req, res, next) => {
  try {
    if (req.user.role === 'super_admin') {
      return next();
    }
    
    if (req.user.role === 'client') {
      // Apply client checks
      return isClient(req, res, next);
    }
    
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied.' 
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Server error.' 
    });
  }
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = {
  verifyToken,
  isSuperAdmin,
  isClient,
  isAuthenticated,
  generateToken
};