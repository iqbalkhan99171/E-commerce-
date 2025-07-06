const express = require('express');
const { runQuery, getRow, getAllRows } = require('../database/database');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(verifyToken);
router.use(isSuperAdmin);

// Get all plans
router.get('/', async (req, res) => {
  try {
    const plans = await getAllRows(
      'SELECT * FROM plans ORDER BY price ASC'
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

// Get single plan
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await getRow(
      'SELECT * FROM plans WHERE id = ?',
      [id]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Get plan usage statistics
    const usageStats = await getRow(
      'SELECT COUNT(*) as subscriber_count FROM client_subscriptions WHERE plan_id = ?',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...plan,
        subscriberCount: usageStats.subscriber_count
      }
    });

  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create new plan
router.post('/', async (req, res) => {
  try {
    const { name, price, durationMonths, features, isTrial } = req.body;

    // Validation
    if (!name || price === undefined || !durationMonths) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and duration are required'
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be negative'
      });
    }

    if (durationMonths <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be positive'
      });
    }

    // Check if plan name already exists
    const existingPlan = await getRow(
      'SELECT id FROM plans WHERE name = ?',
      [name]
    );

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: 'Plan name already exists'
      });
    }

    // Create plan
    const result = await runQuery(
      `INSERT INTO plans (name, price, duration_months, features, is_trial) 
       VALUES (?, ?, ?, ?, ?)`,
      [name, price, durationMonths, features || '', isTrial ? 1 : 0]
    );

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: {
        planId: result.id
      }
    });

  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update plan
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, durationMonths, features, isTrial, status } = req.body;

    // Check if plan exists
    const existingPlan = await getRow(
      'SELECT * FROM plans WHERE id = ?',
      [id]
    );

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Validation
    if (!name || price === undefined || !durationMonths) {
      return res.status(400).json({
        success: false,
        message: 'Name, price, and duration are required'
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be negative'
      });
    }

    if (durationMonths <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be positive'
      });
    }

    // Check if plan name already exists (excluding current plan)
    const duplicatePlan = await getRow(
      'SELECT id FROM plans WHERE name = ? AND id != ?',
      [name, id]
    );

    if (duplicatePlan) {
      return res.status(400).json({
        success: false,
        message: 'Plan name already exists'
      });
    }

    // Update plan
    await runQuery(
      `UPDATE plans SET 
        name = ?, price = ?, duration_months = ?, features = ?, 
        is_trial = ?, status = ?
       WHERE id = ?`,
      [
        name, price, durationMonths, features || '', 
        isTrial ? 1 : 0, status || existingPlan.status, id
      ]
    );

    res.json({
      success: true,
      message: 'Plan updated successfully'
    });

  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete plan
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if plan exists
    const plan = await getRow(
      'SELECT * FROM plans WHERE id = ?',
      [id]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Check if plan is being used by any clients
    const activeSubscriptions = await getRow(
      'SELECT COUNT(*) as count FROM client_subscriptions WHERE plan_id = ? AND status = "active"',
      [id]
    );

    if (activeSubscriptions.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete plan with active subscriptions. Please deactivate the plan instead.'
      });
    }

    // Delete plan
    await runQuery('DELETE FROM plans WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });

  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Toggle plan status (activate/deactivate)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active" or "inactive"'
      });
    }

    // Check if plan exists
    const plan = await getRow(
      'SELECT * FROM plans WHERE id = ?',
      [id]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Update plan status
    await runQuery(
      'UPDATE plans SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: `Plan ${status === 'active' ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Update plan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get plan statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if plan exists
    const plan = await getRow(
      'SELECT * FROM plans WHERE id = ?',
      [id]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Get subscription statistics
    const totalSubscriptions = await getRow(
      'SELECT COUNT(*) as count FROM client_subscriptions WHERE plan_id = ?',
      [id]
    );

    const activeSubscriptions = await getRow(
      'SELECT COUNT(*) as count FROM client_subscriptions WHERE plan_id = ? AND status = "active"',
      [id]
    );

    const expiredSubscriptions = await getRow(
      'SELECT COUNT(*) as count FROM client_subscriptions WHERE plan_id = ? AND status = "expired"',
      [id]
    );

    const totalRevenue = await getRow(
      'SELECT SUM(amount_paid) as total FROM client_subscriptions WHERE plan_id = ? AND payment_status = "confirmed"',
      [id]
    );

    const monthlyRevenue = await getRow(
      `SELECT SUM(amount_paid) as total FROM client_subscriptions 
       WHERE plan_id = ? AND payment_status = "confirmed" 
       AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
      [id]
    );

    // Get monthly subscription trends (last 12 months)
    const monthlyTrends = await getAllRows(
      `SELECT 
         strftime('%Y-%m', created_at) as month,
         COUNT(*) as subscriptions,
         SUM(amount_paid) as revenue
       FROM client_subscriptions 
       WHERE plan_id = ? AND created_at >= date('now', '-12 months')
       GROUP BY strftime('%Y-%m', created_at)
       ORDER BY month DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        plan,
        stats: {
          totalSubscriptions: totalSubscriptions.count,
          activeSubscriptions: activeSubscriptions.count,
          expiredSubscriptions: expiredSubscriptions.count,
          totalRevenue: totalRevenue.total || 0,
          monthlyRevenue: monthlyRevenue.total || 0,
          monthlyTrends
        }
      }
    });

  } catch (error) {
    console.error('Get plan stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all active plans (public endpoint)
router.get('/public/active', (req, res, next) => {
  // Remove authentication middleware for this specific endpoint
  next();
}, async (req, res) => {
  try {
    const plans = await getAllRows(
      'SELECT id, name, price, duration_months, features FROM plans WHERE status = "active" ORDER BY price ASC'
    );

    res.json({
      success: true,
      data: plans
    });

  } catch (error) {
    console.error('Get active plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;