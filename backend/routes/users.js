const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { adminMiddleware, authMiddleware } = require('../middleware/auth');

// Get all users (admin)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, username, full_name, phone_number, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Give user attempts for a pull (admin)
router.post('/:userId/attempts', adminMiddleware, async (req, res) => {
  try {
    const { pull_id, attempts } = req.body;
    const attemptsToAdd = parseInt(attempts, 10);
    if (!pull_id || !Number.isInteger(attemptsToAdd) || attemptsToAdd <= 0) {
      return res.status(400).json({ message: 'Attempts must be a positive number' });
    }

    const [totals] = await db.query(
      'SELECT COALESCE(SUM(attempts), 0) as total FROM user_pull_attempts WHERE pull_id = ?',
      [pull_id]
    );
    const currentTotal = Number(totals[0]?.total || 0);
    if (currentTotal + attemptsToAdd > 100) {
      return res.status(400).json({ message: 'Total attempts for this pull cannot exceed 100' });
    }

    await db.query(
      'INSERT INTO user_pull_attempts (user_id, pull_id, attempts) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE attempts = attempts + ?',
      [req.params.userId, pull_id, attemptsToAdd, attemptsToAdd]
    );
    res.json({ message: 'Attempts updated' });
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

// Delete user (admin)
router.delete('/:userId', adminMiddleware, async (req, res) => {
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

// Update user (admin)
router.put('/:userId', adminMiddleware, async (req, res) => {
  try {
    const { username, full_name, phone_number, password, admin_password } = req.body;
    if (!username || !username.trim() || !full_name || !full_name.trim() || !phone_number || !phone_number.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
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
    const values = [username, full_name, phone_number];

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
