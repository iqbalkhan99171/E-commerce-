const express = require('express');
const { Parser } = require('json2csv');
const moment = require('moment');
const { runQuery, getRow, getAllRows } = require('../database/database');
const { verifyToken, isClient } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all client routes
router.use(verifyToken);
router.use(isClient);

// Client Dashboard Stats
router.get('/dashboard', async (req, res) => {
  try {
    const clientId = req.user.id;

    // Get total members
    const totalMembersResult = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ?',
      [clientId]
    );

    // Get active members
    const activeMembersResult = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ? AND status = "active" AND end_date >= date("now")',
      [clientId]
    );

    // Get expired members
    const expiredMembersResult = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ? AND (status = "expired" OR end_date < date("now"))',
      [clientId]
    );

    // Get total revenue this month
    const monthlyRevenueResult = await getRow(
      `SELECT SUM(amount_paid) as total FROM members 
       WHERE client_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
      [clientId]
    );

    // Get pending payments count
    const pendingPaymentsResult = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ? AND payment_method IS NULL',
      [clientId]
    );

    // Get members expiring today and tomorrow
    const expiringTodayResult = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ? AND end_date = date("now") AND status = "active"',
      [clientId]
    );

    const expiringTomorrowResult = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ? AND end_date = date("now", "+1 day") AND status = "active"',
      [clientId]
    );

    // Get recent member additions (last 7 days)
    const recentMembers = await getAllRows(
      `SELECT name, phone, membership_plan, created_at 
       FROM members 
       WHERE client_id = ? AND created_at >= date('now', '-7 days') 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [clientId]
    );

    // Get current subscription details
    const subscription = await getRow(
      `SELECT cs.*, p.name as plan_name, p.price, p.features 
       FROM client_subscriptions cs 
       JOIN plans p ON cs.plan_id = p.id 
       WHERE cs.client_id = ? 
       ORDER BY cs.created_at DESC 
       LIMIT 1`,
      [clientId]
    );

    res.json({
      success: true,
      data: {
        totalMembers: totalMembersResult.count,
        activeMembers: activeMembersResult.count,
        expiredMembers: expiredMembersResult.count,
        monthlyRevenue: monthlyRevenueResult.total || 0,
        pendingPayments: pendingPaymentsResult.count,
        expiringToday: expiringTodayResult.count,
        expiringTomorrow: expiringTomorrowResult.count,
        recentMembers,
        subscription
      }
    });

  } catch (error) {
    console.error('Client dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get client profile
router.get('/profile', async (req, res) => {
  try {
    const clientId = req.user.id;

    const client = await getRow(
      `SELECT u.*, p.name as plan_name, cs.start_date, cs.end_date, 
              cs.status as subscription_status, cs.payment_status
       FROM users u 
       LEFT JOIN client_subscriptions cs ON u.id = cs.client_id 
       LEFT JOIN plans p ON cs.plan_id = p.id 
       WHERE u.id = ? 
       ORDER BY cs.created_at DESC 
       LIMIT 1`,
      [clientId]
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Remove password from response
    delete client.password;

    res.json({
      success: true,
      data: client
    });

  } catch (error) {
    console.error('Get client profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update client profile
router.put('/profile', async (req, res) => {
  try {
    const clientId = req.user.id;
    const { gymName, ownerName, phone, address } = req.body;

    if (!gymName || !ownerName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Gym name, owner name, and phone are required'
      });
    }

    await runQuery(
      `UPDATE users 
       SET gym_name = ?, owner_name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [gymName, ownerName, phone, address, clientId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update client profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get subscription history
router.get('/subscriptions', async (req, res) => {
  try {
    const clientId = req.user.id;

    const subscriptions = await getAllRows(
      `SELECT cs.*, p.name as plan_name, p.price as plan_price, p.duration_months
       FROM client_subscriptions cs 
       JOIN plans p ON cs.plan_id = p.id 
       WHERE cs.client_id = ? 
       ORDER BY cs.created_at DESC`,
      [clientId]
    );

    res.json({
      success: true,
      data: subscriptions
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get expiring members (today and tomorrow)
router.get('/members/expiring', async (req, res) => {
  try {
    const clientId = req.user.id;

    const expiringToday = await getAllRows(
      `SELECT * FROM members 
       WHERE client_id = ? AND end_date = date('now') AND status = 'active'
       ORDER BY name`,
      [clientId]
    );

    const expiringTomorrow = await getAllRows(
      `SELECT * FROM members 
       WHERE client_id = ? AND end_date = date('now', '+1 day') AND status = 'active'
       ORDER BY name`,
      [clientId]
    );

    const expiringThisWeek = await getAllRows(
      `SELECT * FROM members 
       WHERE client_id = ? 
       AND end_date BETWEEN date('now', '+2 days') AND date('now', '+7 days') 
       AND status = 'active'
       ORDER BY end_date, name`,
      [clientId]
    );

    res.json({
      success: true,
      data: {
        today: expiringToday,
        tomorrow: expiringTomorrow,
        thisWeek: expiringThisWeek
      }
    });

  } catch (error) {
    console.error('Get expiring members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get revenue statistics
router.get('/revenue', async (req, res) => {
  try {
    const clientId = req.user.id;
    const year = req.query.year || new Date().getFullYear();

    // Monthly revenue for the year
    const monthlyRevenue = await getAllRows(
      `SELECT 
         strftime('%m', created_at) as month,
         SUM(amount_paid) as revenue,
         COUNT(*) as member_count
       FROM members 
       WHERE client_id = ? AND strftime('%Y', created_at) = ?
       GROUP BY strftime('%m', created_at)
       ORDER BY month`,
      [clientId, year.toString()]
    );

    // Payment method breakdown
    const paymentMethods = await getAllRows(
      `SELECT 
         payment_method,
         COUNT(*) as count,
         SUM(amount_paid) as total
       FROM members 
       WHERE client_id = ? AND payment_method IS NOT NULL
       GROUP BY payment_method`,
      [clientId]
    );

    // Membership plan breakdown
    const planBreakdown = await getAllRows(
      `SELECT 
         membership_plan,
         COUNT(*) as count,
         SUM(amount_paid) as total
       FROM members 
       WHERE client_id = ?
       GROUP BY membership_plan`,
      [clientId]
    );

    res.json({
      success: true,
      data: {
        monthlyRevenue,
        paymentMethods,
        planBreakdown,
        year
      }
    });

  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Export dashboard data to CSV
router.get('/export/dashboard', async (req, res) => {
  try {
    const clientId = req.user.id;

    const members = await getAllRows(
      `SELECT name, email, phone, membership_plan, start_date, end_date, 
              status, amount_paid, payment_method, upi_id, created_at
       FROM members 
       WHERE client_id = ?
       ORDER BY created_at DESC`,
      [clientId]
    );

    const fields = [
      'name', 'email', 'phone', 'membership_plan', 'start_date', 'end_date',
      'status', 'amount_paid', 'payment_method', 'upi_id', 'created_at'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(members);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="members.csv"');
    res.send(csv);

  } catch (error) {
    console.error('Export dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Check subscription status
router.get('/subscription/status', async (req, res) => {
  try {
    const clientId = req.user.id;

    const subscription = await getRow(
      `SELECT cs.*, p.name as plan_name, p.price, p.features,
              CASE 
                WHEN cs.end_date < date('now') THEN 'expired'
                WHEN cs.end_date <= date('now', '+7 days') THEN 'expiring_soon'
                ELSE 'active'
              END as status_indicator
       FROM client_subscriptions cs 
       JOIN plans p ON cs.plan_id = p.id 
       WHERE cs.client_id = ? 
       ORDER BY cs.created_at DESC 
       LIMIT 1`,
      [clientId]
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No subscription found'
      });
    }

    // Calculate days remaining
    const endDate = moment(subscription.end_date);
    const daysRemaining = endDate.diff(moment(), 'days');

    res.json({
      success: true,
      data: {
        ...subscription,
        daysRemaining: Math.max(0, daysRemaining),
        isExpired: daysRemaining < 0,
        isExpiringSoon: daysRemaining <= 7 && daysRemaining >= 0
      }
    });

  } catch (error) {
    console.error('Check subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;