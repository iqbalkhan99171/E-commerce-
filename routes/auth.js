const express = require('express');
const bcrypt = require('bcrypt');
const { runQuery, getRow, getAllRows } = require('../database/database');
const { generateToken } = require('../middleware/auth');
const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get user from database
    const user = await getRow(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is blocked
    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Account is blocked. Contact support.'
      });
    }

    // For clients, check if approved and has subscription
    if (user.role === 'client') {
      if (user.status === 'pending') {
        return res.status(403).json({
          success: false,
          message: 'Account pending approval. Please wait for admin approval.'
        });
      }

      // Check if client has any subscription
      const subscription = await getRow(
        'SELECT * FROM client_subscriptions WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
        [user.id]
      );

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'No subscription found. Please contact support.'
        });
      }
    }

    // Generate token
    const token = generateToken(user);

    // Remove password from response
    delete user.password;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Client signup endpoint
router.post('/signup', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      gymName, 
      ownerName, 
      phone, 
      address, 
      planId 
    } = req.body;

    // Validation
    if (!email || !password || !gymName || !ownerName || !phone || !planId) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if email already exists
    const existingUser = await getRow(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if plan exists
    const plan = await getRow(
      'SELECT * FROM plans WHERE id = ? AND status = "active"',
      [planId]
    );

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await runQuery(
      `INSERT INTO users (email, password, role, gym_name, owner_name, phone, address, status) 
       VALUES (?, ?, 'client', ?, ?, ?, ?, 'pending')`,
      [email.toLowerCase(), hashedPassword, gymName, ownerName, phone, address]
    );

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.duration_months);

    // Create subscription
    await runQuery(
      `INSERT INTO client_subscriptions (client_id, plan_id, start_date, end_date, status, payment_status, amount_paid) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        userResult.id, 
        planId, 
        startDate.toISOString().split('T')[0], 
        endDate.toISOString().split('T')[0],
        plan.is_trial ? 'trial' : 'active',
        plan.price
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Signup successful! Your account is pending approval.',
      data: {
        userId: userResult.id,
        plan: plan.name,
        pendingApproval: true
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await getAllRows(
      'SELECT * FROM plans WHERE status = "active" ORDER BY price ASC'
    );

    res.json({
      success: true,
      data: plans
    });

  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Verify email endpoint (for email verification if needed)
router.post('/verify-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await getRow(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    res.json({
      success: true,
      exists: !!user
    });

  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;