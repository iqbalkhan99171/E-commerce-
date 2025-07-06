const express = require('express');
const QRCode = require('qrcode');
const { Parser } = require('json2csv');
const moment = require('moment');
const { runQuery, getRow, getAllRows } = require('../database/database');
const { verifyToken, isClient } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all member routes
router.use(verifyToken);
router.use(isClient);

// Get all members for a client
router.get('/', async (req, res) => {
  try {
    const clientId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const plan = req.query.plan || '';

    let query = 'SELECT * FROM members WHERE client_id = ?';
    const params = [clientId];

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR member_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (plan) {
      query += ' AND membership_plan LIKE ?';
      params.push(`%${plan}%`);
    }

    // Update expired members status automatically
    await runQuery(
      'UPDATE members SET status = "expired" WHERE client_id = ? AND end_date < date("now") AND status = "active"',
      [clientId]
    );

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const members = await getAllRows(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as count FROM members WHERE client_id = ?';
    const countParams = [clientId];

    if (search) {
      countQuery += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR member_id LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (plan) {
      countQuery += ' AND membership_plan LIKE ?';
      countParams.push(`%${plan}%`);
    }

    const totalResult = await getRow(countQuery, countParams);

    res.json({
      success: true,
      data: {
        members,
        pagination: {
          page,
          limit,
          total: totalResult.count,
          pages: Math.ceil(totalResult.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get single member
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const member = await getRow(
      'SELECT * FROM members WHERE id = ? AND client_id = ?',
      [id, clientId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Get payment history
    const payments = await getAllRows(
      'SELECT * FROM member_payments WHERE member_id = ? ORDER BY payment_date DESC',
      [id]
    );

    // Get attendance history (last 30 days)
    const attendance = await getAllRows(
      `SELECT * FROM attendance 
       WHERE member_id = ? AND date >= date('now', '-30 days') 
       ORDER BY date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        member,
        payments,
        attendance
      }
    });

  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Create new member
router.post('/', async (req, res) => {
  try {
    const clientId = req.user.id;
    const {
      name,
      email,
      phone,
      membershipPlan,
      startDate,
      endDate,
      amountPaid,
      paymentMethod,
      upiId,
      notes
    } = req.body;

    // Validation
    if (!name || !phone || !membershipPlan || !startDate || !endDate || !amountPaid) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, membership plan, start date, end date, and amount are required'
      });
    }

    // Generate unique member ID
    const memberIdResult = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ?',
      [clientId]
    );
    const memberId = `MEM${String(memberIdResult.count + 1).padStart(4, '0')}`;

    // Generate QR code for the member
    const qrData = JSON.stringify({
      memberId: memberId,
      name: name,
      clientId: clientId,
      type: 'member_qr'
    });
    
    const qrCode = await QRCode.toDataURL(qrData);

    // Create member
    const result = await runQuery(
      `INSERT INTO members (
        client_id, name, email, phone, member_id, membership_plan, 
        start_date, end_date, amount_paid, payment_method, upi_id, notes, qr_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId, name, email, phone, memberId, membershipPlan,
        startDate, endDate, amountPaid, paymentMethod, upiId, notes, qrCode
      ]
    );

    // Record payment
    if (paymentMethod) {
      await runQuery(
        `INSERT INTO member_payments (member_id, amount, payment_method, upi_id, payment_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.id, amountPaid, paymentMethod, upiId, startDate, 'Initial payment']
      );
    }

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: {
        memberId: result.id,
        memberIdNumber: memberId,
        qrCode: qrCode
      }
    });

  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update member
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const {
      name,
      email,
      phone,
      membershipPlan,
      startDate,
      endDate,
      amountPaid,
      paymentMethod,
      upiId,
      notes,
      status
    } = req.body;

    // Check if member exists
    const existingMember = await getRow(
      'SELECT * FROM members WHERE id = ? AND client_id = ?',
      [id, clientId]
    );

    if (!existingMember) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Validation
    if (!name || !phone || !membershipPlan || !startDate || !endDate || !amountPaid) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, membership plan, start date, end date, and amount are required'
      });
    }

    // Update member
    await runQuery(
      `UPDATE members SET 
        name = ?, email = ?, phone = ?, membership_plan = ?, start_date = ?, 
        end_date = ?, amount_paid = ?, payment_method = ?, upi_id = ?, notes = ?, 
        status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND client_id = ?`,
      [
        name, email, phone, membershipPlan, startDate, endDate,
        amountPaid, paymentMethod, upiId, notes, status || existingMember.status,
        id, clientId
      ]
    );

    res.json({
      success: true,
      message: 'Member updated successfully'
    });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete member
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    // Check if member exists
    const member = await getRow(
      'SELECT * FROM members WHERE id = ? AND client_id = ?',
      [id, clientId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Delete related records first
    await runQuery('DELETE FROM member_payments WHERE member_id = ?', [id]);
    await runQuery('DELETE FROM attendance WHERE member_id = ?', [id]);

    // Delete member
    await runQuery('DELETE FROM members WHERE id = ? AND client_id = ?', [id, clientId]);

    res.json({
      success: true,
      message: 'Member deleted successfully'
    });

  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Add payment for member
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const { amount, paymentMethod, upiId, paymentDate, forMonth, notes } = req.body;

    // Validation
    if (!amount || !paymentMethod || !paymentDate) {
      return res.status(400).json({
        success: false,
        message: 'Amount, payment method, and payment date are required'
      });
    }

    // Check if member exists
    const member = await getRow(
      'SELECT * FROM members WHERE id = ? AND client_id = ?',
      [id, clientId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Add payment record
    await runQuery(
      `INSERT INTO member_payments (member_id, amount, payment_method, upi_id, payment_date, for_month, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, amount, paymentMethod, upiId, paymentDate, forMonth, notes]
    );

    res.status(201).json({
      success: true,
      message: 'Payment added successfully'
    });

  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Extend membership
router.post('/:id/extend', async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const { extensionDays, amount, paymentMethod, upiId, notes } = req.body;

    // Validation
    if (!extensionDays || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Extension days and amount are required'
      });
    }

    // Check if member exists
    const member = await getRow(
      'SELECT * FROM members WHERE id = ? AND client_id = ?',
      [id, clientId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Calculate new end date
    const currentEndDate = new Date(member.end_date);
    const newEndDate = new Date(currentEndDate.getTime() + (extensionDays * 24 * 60 * 60 * 1000));

    // Update member
    await runQuery(
      'UPDATE members SET end_date = ?, status = "active", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND client_id = ?',
      [newEndDate.toISOString().split('T')[0], id, clientId]
    );

    // Add payment record
    if (paymentMethod) {
      await runQuery(
        `INSERT INTO member_payments (member_id, amount, payment_method, upi_id, payment_date, notes)
         VALUES (?, ?, ?, ?, date('now'), ?)`,
        [id, amount, paymentMethod, upiId, notes || `Membership extended by ${extensionDays} days`]
      );
    }

    res.json({
      success: true,
      message: 'Membership extended successfully',
      data: {
        newEndDate: newEndDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Extend membership error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Mark attendance (QR code scan)
router.post('/:id/attendance', async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Check if member exists and is active
    const member = await getRow(
      'SELECT * FROM members WHERE id = ? AND client_id = ? AND status = "active"',
      [id, clientId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Active member not found'
      });
    }

    // Check if already checked in today
    const existingAttendance = await getRow(
      'SELECT * FROM attendance WHERE member_id = ? AND date = ?',
      [id, today]
    );

    if (existingAttendance) {
      if (!existingAttendance.check_out_time) {
        // Check out
        await runQuery(
          'UPDATE attendance SET check_out_time = CURRENT_TIMESTAMP WHERE id = ?',
          [existingAttendance.id]
        );

        res.json({
          success: true,
          message: 'Check-out recorded successfully',
          type: 'checkout'
        });
      } else {
        res.json({
          success: false,
          message: 'Already checked in and out today'
        });
      }
    } else {
      // Check in
      await runQuery(
        'INSERT INTO attendance (member_id, date) VALUES (?, ?)',
        [id, today]
      );

      res.json({
        success: true,
        message: 'Check-in recorded successfully',
        type: 'checkin'
      });
    }

  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get member QR code
router.get('/:id/qr', async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.id;

    const member = await getRow(
      'SELECT qr_code, name, member_id FROM members WHERE id = ? AND client_id = ?',
      [id, clientId]
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      data: {
        qrCode: member.qr_code,
        name: member.name,
        memberId: member.member_id
      }
    });

  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Export members to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const clientId = req.user.id;

    const members = await getAllRows(
      `SELECT name, email, phone, member_id, membership_plan, start_date, end_date, 
              status, amount_paid, payment_method, upi_id, created_at
       FROM members 
       WHERE client_id = ?
       ORDER BY created_at DESC`,
      [clientId]
    );

    const fields = [
      'name', 'email', 'phone', 'member_id', 'membership_plan', 'start_date', 'end_date',
      'status', 'amount_paid', 'payment_method', 'upi_id', 'created_at'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(members);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="members.csv"');
    res.send(csv);

  } catch (error) {
    console.error('Export members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get member statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const clientId = req.user.id;

    // Get various statistics
    const totalMembers = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ?',
      [clientId]
    );

    const activeMembers = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ? AND status = "active" AND end_date >= date("now")',
      [clientId]
    );

    const expiredMembers = await getRow(
      'SELECT COUNT(*) as count FROM members WHERE client_id = ? AND (status = "expired" OR end_date < date("now"))',
      [clientId]
    );

    const thisMonthRevenue = await getRow(
      `SELECT SUM(amount_paid) as total FROM members 
       WHERE client_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
      [clientId]
    );

    const membershipPlans = await getAllRows(
      `SELECT membership_plan, COUNT(*) as count, SUM(amount_paid) as revenue
       FROM members WHERE client_id = ?
       GROUP BY membership_plan
       ORDER BY count DESC`,
      [clientId]
    );

    res.json({
      success: true,
      data: {
        totalMembers: totalMembers.count,
        activeMembers: activeMembers.count,
        expiredMembers: expiredMembers.count,
        thisMonthRevenue: thisMonthRevenue.total || 0,
        membershipPlans
      }
    });

  } catch (error) {
    console.error('Get member stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;