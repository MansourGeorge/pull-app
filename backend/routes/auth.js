const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim() || !password || !password.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: rows[0].id, username, role: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    res.json({
      token,
      role: 'admin',
      username,
      id: rows[0].id,
      phone_number: rows[0].phone_number
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Current user (admin or user)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const [rows] = await db.query(
        'SELECT id, username, phone_number, created_at FROM admins WHERE id = ?',
        [req.user.id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Admin not found' });
      return res.json({ role: 'admin', user: rows[0] });
    }

    if (req.user.role === 'user') {
      const [rows] = await db.query(
        'SELECT id, username, full_name, phone_number, created_at FROM users WHERE id = ?',
        [req.user.id]
      );
      if (!rows.length) return res.status(404).json({ message: 'User not found' });
      return res.json({ role: 'user', user: rows[0] });
    }

    return res.status(400).json({ message: 'Invalid token role' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin profile
router.get('/admin/profile', adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, phone_number, created_at FROM admins WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Admin not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update admin profile
router.put('/admin/profile', adminMiddleware, async (req, res) => {
  try {
    const { username, phone_number } = req.body;
    if (!username || !username.trim() || !phone_number || !phone_number.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existing] = await db.query(
      'SELECT id FROM admins WHERE username = ? AND id <> ?',
      [username, req.user.id]
    );
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });

    await db.query(
      'UPDATE admins SET username = ?, phone_number = ? WHERE id = ?',
      [username, phone_number, req.user.id]
    );

    const [rows] = await db.query(
      'SELECT id, username, phone_number FROM admins WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin change password
router.put('/admin/change-password', adminMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !currentPassword.trim() || !newPassword || !newPassword.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admins SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User register
router.post('/user/register', async (req, res) => {
  try {
    const { username, full_name, phone_number, password } = req.body;
    if (
      !username || !username.trim() ||
      !full_name || !full_name.trim() ||
      !phone_number || !phone_number.trim() ||
      !password || !password.trim()
    ) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, full_name, phone_number, password) VALUES (?, ?, ?, ?)',
      [username, full_name, phone_number, hashed]
    );
    const token = jwt.sign({ id: result.insertId, username, role: 'user' }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    res.json({ token, role: 'user', username, id: result.insertId, full_name, phone_number });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User login
router.post('/user/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim() || !password || !password.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: rows[0].id, username, role: 'user' }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    res.json({
      token,
      role: 'user',
      username,
      id: rows[0].id,
      full_name: rows[0].full_name,
      phone_number: rows[0].phone_number
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User profile
router.get('/user/profile', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, full_name, phone_number, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update user profile
router.put('/user/profile', authMiddleware, async (req, res) => {
  try {
    const { username, full_name, phone_number } = req.body;
    if (
      !username || !username.trim() ||
      !full_name || !full_name.trim() ||
      !phone_number || !phone_number.trim()
    ) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? AND id <> ?',
      [username, req.user.id]
    );
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });

    await db.query(
      'UPDATE users SET username = ?, full_name = ?, phone_number = ? WHERE id = ?',
      [username, full_name, phone_number, req.user.id]
    );

    const [rows] = await db.query(
      'SELECT id, username, full_name, phone_number FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// User change password
router.put('/user/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !currentPassword.trim() || !newPassword || !newPassword.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
