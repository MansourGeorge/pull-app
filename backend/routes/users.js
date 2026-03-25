const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { adminMiddleware, superAdminMiddleware, authMiddleware } = require('../middleware/auth');
const { normalizeLebanesePhone, isValidLebanesePhone } = require('../utils/phone');
const LOYALTY_REDEEM_UNIT = 5;
const safeInsertReportEntry = async (queryable, values) => {
  try {
    await queryable.query(
      `INSERT INTO admin_report_ledger (admin_id, actor_admin_id, user_id, pull_id, pull_number, entry_type, amount, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  } catch (err) {
    console.warn('Report ledger insert skipped:', err.message);
  }
};

// Get all users (admin)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, username, full_name, phone_number, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get user funds for a specific pull (admin/subadmin)
router.get('/:userId/attempts', adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Valid user is required' });
    }
    const [userRows] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [fundRows] = await db.query(
      'SELECT balance, loyalty_balance FROM user_admin_wallets WHERE user_id = ? AND admin_id = ?',
      [userId, req.user.id]
    );
    const currentBalance = Number(fundRows[0]?.balance || 0) + Number(fundRows[0]?.loyalty_balance || 0);

    res.json({
      currentBalance,
      // Backward-compatible aliases
      allowedAttempts: currentBalance,
      usedAttempts: 0,
      remainingAttempts: 0
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Add/remove user funds for a pull (admin/subadmin)
router.post('/:userId/attempts', adminMiddleware, async (req, res) => {
  try {
    const { action } = req.body;
    const amountRaw = req.body.amount !== undefined ? req.body.amount : req.body.attempts;
    const userId = parseInt(req.params.userId, 10);
    const amount = Number.parseFloat(amountRaw);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    const normalizedAmount = Number(amount.toFixed(2));
    const [userRows] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const mode = action === 'remove' ? 'remove' : 'add';

    if (mode === 'add') {
      await db.query(
        'INSERT INTO user_admin_wallets (user_id, admin_id, balance) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)',
        [userId, req.user.id, normalizedAmount]
      );
    } else {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const [walletRows] = await conn.query(
          'SELECT balance, loyalty_balance FROM user_admin_wallets WHERE user_id = ? AND admin_id = ? FOR UPDATE',
          [userId, req.user.id]
        );

        const regularBalance = Number(walletRows[0]?.balance || 0);
        const loyaltyBalance = Number(walletRows[0]?.loyalty_balance || 0);
        const totalBalance = Number((regularBalance + loyaltyBalance).toFixed(2));

        if (totalBalance < normalizedAmount) {
          await conn.rollback();
          return res.status(400).json({ message: 'Insufficient balance for cashback' });
        }

        let remainingToDeduct = normalizedAmount;
        const deductFromRegular = Math.min(regularBalance, remainingToDeduct);
        if (deductFromRegular > 0) {
          await conn.query(
            'UPDATE user_admin_wallets SET balance = balance - ? WHERE user_id = ? AND admin_id = ?',
            [deductFromRegular, userId, req.user.id]
          );
          remainingToDeduct = Number((remainingToDeduct - deductFromRegular).toFixed(2));
        }

        if (remainingToDeduct > 0) {
          const deductFromLoyalty = Math.min(loyaltyBalance, remainingToDeduct);
          await conn.query(
            'UPDATE user_admin_wallets SET loyalty_balance = loyalty_balance - ? WHERE user_id = ? AND admin_id = ?',
            [deductFromLoyalty, userId, req.user.id]
          );
          remainingToDeduct = Number((remainingToDeduct - deductFromLoyalty).toFixed(2));
        }

        if (remainingToDeduct > 0) {
          await conn.rollback();
          return res.status(400).json({ message: 'Insufficient balance for cashback' });
        }

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    await safeInsertReportEntry(db, [
      req.user.id,
      req.user.id,
      userId,
      null,
      null,
      mode === 'add' ? 'fund_add' : 'cashback',
      normalizedAmount,
      mode === 'add' ? 'Funds added to user wallet' : 'Cashback from user wallet'
    ]);

    const [updatedRows] = await db.query(
      'SELECT balance, loyalty_balance FROM user_admin_wallets WHERE user_id = ? AND admin_id = ?',
      [userId, req.user.id]
    );
    const currentBalance = Number(updatedRows[0]?.balance || 0) + Number(updatedRows[0]?.loyalty_balance || 0);

    res.json({
      message: mode === 'add' ? 'Funds updated' : 'Cashback completed',
      currentBalance,
      // Backward-compatible aliases
      allowedAttempts: currentBalance
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get wallet summary for current user
router.get('/me/wallet-summary', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COALESCE(SUM(balance + loyalty_balance), 0) AS total_balance FROM user_admin_wallets WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ totalBalance: Number(rows[0]?.total_balance || 0) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get loyalty summary per admin for current user
router.get('/me/loyalty', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.json([]);
    }

    const [rows] = await db.query(
      `SELECT a.id AS admin_id,
              a.username AS admin_username,
              a.full_name AS admin_full_name,
              COALESCE(a.loyalty_percentage, 0) AS loyalty_percentage,
              COALESCE(l.spend_carry, 0) AS spend_progress,
              COALESCE(l.total_spent, 0) AS total_spent,
              COALESCE(l.total_rewards_generated, 0) AS total_rewards_generated,
              COALESCE(l.total_rewards_redeemed, 0) AS total_rewards_redeemed,
              COALESCE(c.available_codes_count, 0) AS available_codes_count,
              COALESCE(c.available_codes_amount, 0) AS available_codes_amount
       FROM admins a
       JOIN (
         SELECT admin_id FROM user_admin_wallets WHERE user_id = ?
         UNION
         SELECT admin_id FROM user_admin_loyalty WHERE user_id = ?
       ) ua ON ua.admin_id = a.id
       LEFT JOIN user_admin_loyalty l
              ON l.user_id = ? AND l.admin_id = a.id
       LEFT JOIN (
         SELECT admin_id,
                COUNT(*) AS available_codes_count,
                COALESCE(SUM(amount), 0) AS available_codes_amount
         FROM loyalty_redeem_codes
         WHERE user_id = ? AND status = 'available'
         GROUP BY admin_id
       ) c ON c.admin_id = a.id
       ORDER BY COALESCE(NULLIF(a.full_name, ''), a.username) ASC`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );

    res.json(rows.map((row) => ({
      adminId: Number(row.admin_id),
      adminName: row.admin_full_name && String(row.admin_full_name).trim()
        ? String(row.admin_full_name).trim()
        : row.admin_username,
      adminUsername: row.admin_username,
      loyaltyPercentage: Number(row.loyalty_percentage || 0),
      spendProgress: Number(row.spend_progress || 0),
      spendTarget: LOYALTY_REDEEM_UNIT,
      pendingReward: Number(row.spend_progress || 0),
      nextRewardAmount: Number(row.loyalty_percentage || 0) > 0 ? LOYALTY_REDEEM_UNIT : 0,
      totalSpent: Number(row.total_spent || 0),
      totalRewardsGenerated: Number(row.total_rewards_generated || 0),
      totalRewardsRedeemed: Number(row.total_rewards_redeemed || 0),
      availableCodesCount: Number(row.available_codes_count || 0),
      availableCodesAmount: Number(row.available_codes_amount || 0)
    })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// List available redeem codes for current user
router.get('/me/redeem-codes', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.json([]);
    }

    const [rows] = await db.query(
      `SELECT c.code,
              c.amount,
              c.admin_id,
              c.created_at,
              a.username AS admin_username,
              a.full_name AS admin_full_name
       FROM loyalty_redeem_codes c
       JOIN admins a ON a.id = c.admin_id
       WHERE c.user_id = ? AND c.status = 'available'
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    res.json(rows.map((row) => ({
      code: row.code,
      amount: Number(row.amount || 0),
      adminId: Number(row.admin_id),
      adminName: row.admin_full_name && String(row.admin_full_name).trim()
        ? String(row.admin_full_name).trim()
        : row.admin_username,
      adminUsername: row.admin_username,
      createdAt: row.created_at
    })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Redeem code from loyalty page (credits admin-specific wallet)
router.post('/me/redeem-code', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'User access required' });
    }

    const normalizedCode = String(req.body?.code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return res.status(400).json({ message: 'Redeem code is required' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [codeRows] = await conn.query(
        `SELECT id, admin_id, amount, status
         FROM loyalty_redeem_codes
         WHERE code = ? AND user_id = ?
         FOR UPDATE`,
        [normalizedCode, req.user.id]
      );
      if (!codeRows.length) {
        await conn.rollback();
        return res.status(404).json({ message: 'Invalid redeem code' });
      }

      const codeRow = codeRows[0];
      if (codeRow.status !== 'available') {
        await conn.rollback();
        return res.status(400).json({ message: 'Redeem code already used' });
      }

      const redeemAmount = Number(codeRow.amount || 0);
      if (!Number.isFinite(redeemAmount) || redeemAmount <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid redeem amount' });
      }

      await conn.query(
        `UPDATE loyalty_redeem_codes
         SET status = 'redeemed', redeemed_at = NOW(), redeemed_pull_id = NULL
         WHERE id = ?`,
        [codeRow.id]
      );

      await conn.query(
        `INSERT INTO user_admin_wallets (user_id, admin_id, loyalty_balance)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE loyalty_balance = loyalty_balance + VALUES(loyalty_balance)`,
        [req.user.id, codeRow.admin_id, redeemAmount]
      );

      await conn.query(
        `INSERT INTO user_admin_loyalty (user_id, admin_id, total_rewards_redeemed)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE total_rewards_redeemed = total_rewards_redeemed + VALUES(total_rewards_redeemed)`,
        [req.user.id, codeRow.admin_id, redeemAmount]
      );

      await safeInsertReportEntry(conn, [
        codeRow.admin_id,
        null,
        req.user.id,
        null,
        null,
        'redeem_applied',
        redeemAmount,
        `Redeem code ${normalizedCode}`
      ]);

      const [adminRows] = await conn.query(
        'SELECT username, full_name FROM admins WHERE id = ?',
        [codeRow.admin_id]
      );
      const adminUsername = adminRows[0]?.username || '';
      const adminName = adminRows[0]?.full_name && String(adminRows[0].full_name).trim()
        ? String(adminRows[0].full_name).trim()
        : adminUsername;

      const [walletRows] = await conn.query(
        'SELECT balance, loyalty_balance FROM user_admin_wallets WHERE user_id = ? AND admin_id = ?',
        [req.user.id, codeRow.admin_id]
      );
      const currentAdminBalance = Number(walletRows[0]?.balance || 0) + Number(walletRows[0]?.loyalty_balance || 0);

      await conn.commit();
      res.json({
        message: 'Redeem code applied successfully',
        amountAdded: redeemAmount,
        adminId: Number(codeRow.admin_id),
        adminName,
        adminUsername,
        currentAdminBalance
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ message: err.message });
    } finally {
      conn.release();
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get user history
router.get('/me/history', authMiddleware, async (req, res) => {
  try {
    const [data] = await db.query(
      `SELECT p.id,
              p.title,
              p.description,
              p.status,
              p.winner_number,
              p.created_at,
              pn.my_numbers,
              pn.my_names,
              ph.winner_number as drawn_winner,
              win_name.arabic_name as winner_arabic_name,
              wu.full_name as winner_full_name
       FROM pulls p
       JOIN (
         SELECT pull_id,
                GROUP_CONCAT(number ORDER BY number) as my_numbers,
                GROUP_CONCAT(arabic_name ORDER BY number) as my_names
         FROM pull_numbers
         WHERE user_id = ?
         GROUP BY pull_id
       ) pn ON pn.pull_id = p.id
       LEFT JOIN pull_history ph ON ph.pull_id = p.id
       LEFT JOIN pull_numbers win_name ON win_name.pull_id = p.id AND win_name.number = ph.winner_number
       LEFT JOIN users wu ON wu.id = ph.winner_user_id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(data);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete user (main admin only)
router.delete('/:userId', superAdminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE pull_numbers SET user_id = NULL, reserved_at = NULL WHERE user_id = ?', [userId]);
      await conn.query('UPDATE pull_history SET winner_user_id = NULL WHERE winner_user_id = ?', [userId]);
      await conn.query('DELETE FROM users WHERE id = ?', [userId]);
      await conn.commit();
      res.json({ message: 'User deleted' });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ message: err.message });
    } finally {
      conn.release();
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update user (main admin only)
router.put('/:userId', superAdminMiddleware, async (req, res) => {
  try {
    const { username, full_name, phone_number, password, admin_password } = req.body;
    if (!username || !username.trim() || !full_name || !full_name.trim() || !phone_number || !phone_number.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const normalizedPhone = normalizeLebanesePhone(phone_number);
    if (!isValidLebanesePhone(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
    }
    if (!admin_password || !String(admin_password).trim()) {
      return res.status(400).json({ message: 'Admin password is required' });
    }

    const [adminRows] = await db.query('SELECT password FROM admins WHERE id = ?', [req.user.id]);
    if (!adminRows.length) return res.status(401).json({ message: 'Invalid admin credentials' });
    const adminValid = await bcrypt.compare(admin_password, adminRows[0].password);
    if (!adminValid) return res.status(403).json({ message: 'Invalid admin password' });

    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? AND id <> ?',
      [username, req.params.userId]
    );
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });

    const updates = ['username = ?', 'full_name = ?', 'phone_number = ?'];
    const values = [username, full_name, normalizedPhone];

    if (password && String(password).trim()) {
      const hashed = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashed);
    }

    values.push(req.params.userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await db.query(
      'SELECT id, username, full_name, phone_number, created_at FROM users WHERE id = ?',
      [req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
