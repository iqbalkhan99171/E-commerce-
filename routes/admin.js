const express = require('express');
const bcrypt = require('bcrypt');
const { Parser } = require('json2csv');
const { runQuery, getRow, getAllRows } = require('../database/database');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(verifyToken);
router.use(isSuperAdmin);

// Admin Dashboard Stats
router.get('/dashboard', async (req, res) => {
  try {
    // Get total clients
    const totalClientsResult = await getRow(
      'SELECT COUNT(*) as count FROM users WHERE role = "client"'
    );

    // Get active clients
    const activeClientsResult = await getRow(
      `SELECT COUNT(DISTINCT u.id) as count 
       FROM users u 
       JOIN client_subscriptions cs ON u.id = cs.client_id 
       WHERE u.role = "client" AND u.status = "approved" 
       AND cs.status = "active" AND cs.end_date >= date('now')`
    );

    // Get pending approvals
    const pendingApprovalsResult = await getRow(
      'SELECT COUNT(*) as count FROM users WHERE role = "client" AND status = "pending"'
    );

    // Get total revenue
    const totalRevenueResult = await getRow(
      'SELECT SUM(amount_paid) as total FROM client_subscriptions WHERE payment_status = "confirmed"'
    );

    // Get monthly revenue (current month)
    const monthlyRevenueResult = await getRow(
      `SELECT SUM(amount_paid) as total 
       FROM client_subscriptions 
       WHERE payment_status = "confirmed" 
       AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );

    // Get recent signups (last 30 days)
    const recentSignups = await getAllRows(
      `SELECT u.*, p.name as plan_name 
       FROM users u 
       JOIN client_subscriptions cs ON u.id = cs.client_id 
       JOIN plans p ON cs.plan_id = p.id 
       WHERE u.role = "client" 
       AND u.created_at >= date('now', '-30 days') 
       ORDER BY u.created_at DESC 
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        totalClients: totalClientsResult.count,
        activeClients: activeClientsResult.count,
        pendingApprovals: pendingApprovalsResult.count,
        totalRevenue: totalRevenueResult.total || 0,
        monthlyRevenue: monthlyRevenueResult.total || 0,
        recentSignups
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all clients
router.get('/clients', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = `
      SELECT u.*, p.name as plan_name, cs.status as subscription_status, 
             cs.end_date, cs.payment_status, cs.amount_paid
      FROM users u 
      LEFT JOIN client_subscriptions cs ON u.id = cs.client_id 
      LEFT JOIN plans p ON cs.plan_id = p.id 
      WHERE u.role = "client"
    `;
    
    const params = [];

    if (search) {
      query += ' AND (u.gym_name LIKE ? OR u.owner_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND u.status = ?';
      params.push(status);
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const clients = await getAllRows(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM users WHERE role = "client"';
    const countParams = [];

    if (search) {
      countQuery += ' AND (gym_name LIKE ? OR owner_name LIKE ? OR email LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const totalResult = await getRow(countQuery, countParams);

    res.json({
      success: true,
      data: {
        clients,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          pages: Math.ceil(totalResult.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Approve/Reject client
router.put('/clients/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved', 'blocked', 'pending'

    if (!['approved', 'blocked', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Check if client exists
    const client = await getRow(
      'SELECT * FROM users WHERE id = ? AND role = "client"',
      [id]
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Update client status
    await runQuery(
      'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    // If approving client, also update subscription payment status for trial plans
    if (status === 'approved') {
      const subscription = await getRow(
        'SELECT cs.*, p.is_trial FROM client_subscriptions cs JOIN plans p ON cs.plan_id = p.id WHERE cs.client_id = ? ORDER BY cs.created_at DESC LIMIT 1',
        [id]
      );

      if (subscription && subscription.is_trial) {
        await runQuery(
          'UPDATE client_subscriptions SET payment_status = "confirmed" WHERE id = ?',
          [subscription.id]
        );
      }
    }

    res.json({
      success: true,
      message: `Client ${status} successfully`
    });

  } catch (error) {
    console.error('Update client status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get client details
router.get('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await getRow(
      `SELECT u.*, p.name as plan_name, cs.status as subscription_status, 
              cs.start_date, cs.end_date, cs.payment_status, cs.amount_paid, cs.payment_method
       FROM users u 
       LEFT JOIN client_subscriptions cs ON u.id = cs.client_id 
       LEFT JOIN plans p ON cs.plan_id = p.id 
       WHERE u.id = ? AND u.role = "client"
       ORDER BY cs.created_at DESC LIMIT 1`,
      [id]
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's members count
    const membersCount = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ?',
      [id]
    );

    // Get subscription history
    const subscriptions = await getAllRows(
      `SELECT cs.*, p.name as plan_name 
       FROM client_subscriptions cs 
       JOIN plans p ON cs.plan_id = p.id 
       WHERE cs.client_id = ? 
       ORDER BY cs.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        client,
        membersCount: membersCount.count,
        subscriptions
      }
    });

  } catch (error) {
    console.error('Get client details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create new client (by admin)
router.post('/clients', async (req, res) => {
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

    // Create user (auto-approved when created by admin)
    const userResult = await runQuery(
      `INSERT INTO users (email, password, role, gym_name, owner_name, phone, address, status) 
       VALUES (?, ?, 'client', ?, ?, ?, ?, 'approved')`,
      [email.toLowerCase(), hashedPassword, gymName, ownerName, phone, address]
    );

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.duration_months);

    // Create subscription
    await runQuery(
      `INSERT INTO client_subscriptions (client_id, plan_id, start_date, end_date, status, payment_status, amount_paid) 
       VALUES (?, ?, ?, ?, ?, 'confirmed', ?)`,
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
      message: 'Client created successfully',
      data: {
        userId: userResult.id
      }
    });

  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete client
router.delete('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client exists
    const client = await getRow(
      'SELECT * FROM users WHERE id = ? AND role = "client"',
      [id]
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Delete client's members first
    await runQuery('DELETE FROM member_payments WHERE member_id IN (SELECT id FROM members WHERE client_id = ?)', [id]);
    await runQuery('DELETE FROM attendance WHERE member_id IN (SELECT id FROM members WHERE client_id = ?)', [id]);
    await runQuery('DELETE FROM members WHERE client_id = ?', [id]);

    // Delete client's subscriptions
    await runQuery('DELETE FROM client_subscriptions WHERE client_id = ?', [id]);

    // Delete client
    await runQuery('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Export clients to CSV
router.get('/export/clients', async (req, res) => {
  try {
    const clients = await getAllRows(
      `SELECT u.email, u.gym_name, u.owner_name, u.phone, u.address, u.status,
              p.name as plan_name, cs.start_date, cs.end_date, cs.payment_status, cs.amount_paid
       FROM users u 
       LEFT JOIN client_subscriptions cs ON u.id = cs.client_id 
       LEFT JOIN plans p ON cs.plan_id = p.id 
       WHERE u.role = "client"
       ORDER BY u.created_at DESC`
    );

    const fields = [
      'email', 'gym_name', 'owner_name', 'phone', 'address', 'status',
      'plan_name', 'start_date', 'end_date', 'payment_status', 'amount_paid'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(clients);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    res.send(csv);

  } catch (error) {
    console.error('Export clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;