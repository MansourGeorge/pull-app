const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authMiddleware, adminMiddleware, superAdminMiddleware } = require('../middleware/auth');
const { normalizeLebanesePhone, isValidLebanesePhone } = require('../utils/phone');

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

    const role = rows[0].role === 'subadmin' ? 'subadmin' : 'admin';
    const token = jwt.sign({ id: rows[0].id, username, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    res.json({
      token,
      role,
      username,
      id: rows[0].id,
      full_name: rows[0].full_name || rows[0].username,
      phone_number: rows[0].phone_number,
      loyalty_percentage: Number(rows[0].loyalty_percentage || 0)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Current user (admin or user)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'subadmin') {
      const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [req.user.id]);
      if (!rows.length) return res.status(404).json({ message: 'Admin not found' });
      const dbRole = rows[0].role === 'subadmin' ? 'subadmin' : 'admin';
      return res.json({
        role: dbRole,
        user: {
          id: rows[0].id,
          username: rows[0].username,
          full_name: rows[0].full_name || rows[0].username,
          phone_number: rows[0].phone_number,
          loyalty_percentage: Number(rows[0].loyalty_percentage || 0),
          created_at: rows[0].created_at,
          role: dbRole
        }
      });
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
    const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'Admin not found' });
    const dbRole = rows[0].role === 'subadmin' ? 'subadmin' : 'admin';
    res.json({
      id: rows[0].id,
      username: rows[0].username,
      full_name: rows[0].full_name || rows[0].username,
      phone_number: rows[0].phone_number,
      loyalty_percentage: Number(rows[0].loyalty_percentage || 0),
      created_at: rows[0].created_at,
      role: dbRole
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update admin profile
router.put('/admin/profile', adminMiddleware, async (req, res) => {
  try {
    const { username, full_name, phone_number, loyalty_percentage } = req.body;
    if (!username || !username.trim() || !full_name || !String(full_name).trim() || !phone_number || !phone_number.trim()) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const normalizedPhone = normalizeLebanesePhone(phone_number);
    if (!isValidLebanesePhone(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
    }

    let loyaltyPercentageValue = undefined;
    if (loyalty_percentage !== undefined) {
      loyaltyPercentageValue = Number.parseFloat(loyalty_percentage);
      if (!Number.isFinite(loyaltyPercentageValue) || loyaltyPercentageValue < 0 || loyaltyPercentageValue > 100) {
        return res.status(400).json({ message: 'Loyalty percentage must be between 0 and 100' });
      }
      loyaltyPercentageValue = Number(loyaltyPercentageValue.toFixed(2));
    }

    const [existing] = await db.query(
      'SELECT id FROM admins WHERE username = ? AND id <> ?',
      [username, req.user.id]
    );
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });

    if (loyaltyPercentageValue === undefined) {
      await db.query(
        'UPDATE admins SET username = ?, full_name = ?, phone_number = ? WHERE id = ?',
        [username, String(full_name).trim(), normalizedPhone, req.user.id]
      );
    } else {
      await db.query(
        'UPDATE admins SET username = ?, full_name = ?, phone_number = ?, loyalty_percentage = ? WHERE id = ?',
        [username, String(full_name).trim(), normalizedPhone, loyaltyPercentageValue, req.user.id]
      );
    }

    const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [req.user.id]);
    const dbRole = rows[0]?.role === 'subadmin' ? 'subadmin' : 'admin';
    res.json({
      id: rows[0]?.id,
      username: rows[0]?.username,
      full_name: rows[0]?.full_name || rows[0]?.username,
      phone_number: rows[0]?.phone_number,
      loyalty_percentage: Number(rows[0]?.loyalty_percentage || 0),
      role: dbRole
    });
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

// Create subadmin (main admin only)
router.post('/admin/subadmins', superAdminMiddleware, async (req, res) => {
  try {
    const { username, full_name, password, phone_number } = req.body;
    if (
      !username || !String(username).trim() ||
      !full_name || !String(full_name).trim() ||
      !phone_number || !String(phone_number).trim() ||
      !password || !String(password).trim()
    ) {
      return res.status(400).json({ message: 'Username, full name, phone number and password are required' });
    }
    if (String(password).trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const [existing] = await db.query('SELECT id FROM admins WHERE username = ?', [String(username).trim()]);
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });

    const hashed = await bcrypt.hash(String(password).trim(), 10);
    const normalizedPhone = normalizeLebanesePhone(phone_number);
    const normalizedFullName = String(full_name).trim();
    if (!isValidLebanesePhone(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
    }

    const [result] = await db.query(
      'INSERT INTO admins (username, full_name, password, phone_number, role) VALUES (?, ?, ?, ?, ?)',
      [String(username).trim(), normalizedFullName, hashed, normalizedPhone, 'subadmin']
    );

    const [rows] = await db.query(
      'SELECT id, username, full_name, phone_number, created_at FROM admins WHERE id = ?',
      [result.insertId]
    );
    res.json({ message: 'Subadmin created successfully', subadmin: { ...rows[0], role: 'subadmin' } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List subadmins (main admin only)
router.get('/admin/subadmins', superAdminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, full_name, phone_number, created_at, role FROM admins WHERE role = 'subadmin' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update subadmin (main admin only)
router.put('/admin/subadmins/:id', superAdminMiddleware, async (req, res) => {
  try {
    const subadminId = parseInt(req.params.id, 10);
    if (!Number.isInteger(subadminId)) {
      return res.status(400).json({ message: 'Invalid subadmin id' });
    }

    const [targetRows] = await db.query(
      "SELECT id FROM admins WHERE id = ? AND role = 'subadmin'",
      [subadminId]
    );
    if (!targetRows.length) return res.status(404).json({ message: 'Subadmin not found' });

    const { username, full_name, phone_number, password } = req.body;
    if (
      !username || !String(username).trim() ||
      !full_name || !String(full_name).trim() ||
      !phone_number || !String(phone_number).trim()
    ) {
      return res.status(400).json({ message: 'Username, full name and phone number are required' });
    }

    const normalizedUsername = String(username).trim();
    const normalizedPhone = String(phone_number).trim();
    const normalizedFullName = String(full_name).trim();
    if (!isValidLebanesePhone(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
    }
    const normalizedLebanesePhone = normalizeLebanesePhone(normalizedPhone);

    const [existing] = await db.query(
      'SELECT id FROM admins WHERE username = ? AND id <> ?',
      [normalizedUsername, subadminId]
    );
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });

    if (password && String(password).trim().length > 0) {
      if (String(password).trim().length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      const hashed = await bcrypt.hash(String(password).trim(), 10);
      await db.query(
        'UPDATE admins SET username = ?, full_name = ?, phone_number = ?, password = ? WHERE id = ? AND role = ?',
        [normalizedUsername, normalizedFullName, normalizedLebanesePhone, hashed, subadminId, 'subadmin']
      );
    } else {
      await db.query(
        'UPDATE admins SET username = ?, full_name = ?, phone_number = ? WHERE id = ? AND role = ?',
        [normalizedUsername, normalizedFullName, normalizedLebanesePhone, subadminId, 'subadmin']
      );
    }

    const [rows] = await db.query(
      "SELECT id, username, full_name, phone_number, created_at, role FROM admins WHERE id = ? AND role = 'subadmin'",
      [subadminId]
    );
    res.json({ message: 'Subadmin updated successfully', subadmin: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete subadmin (main admin only)
router.delete('/admin/subadmins/:id', superAdminMiddleware, async (req, res) => {
  try {
    const subadminId = parseInt(req.params.id, 10);
    if (!Number.isInteger(subadminId)) {
      return res.status(400).json({ message: 'Invalid subadmin id' });
    }

    const [result] = await db.query(
      "DELETE FROM admins WHERE id = ? AND role = 'subadmin'",
      [subadminId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Subadmin not found' });

    res.json({ message: 'Subadmin deleted successfully' });
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
    const normalizedPhone = normalizeLebanesePhone(phone_number);
    if (!isValidLebanesePhone(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, full_name, phone_number, password) VALUES (?, ?, ?, ?)',
      [username, full_name, normalizedPhone, hashed]
    );
    const token = jwt.sign({ id: result.insertId, username, role: 'user' }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    res.json({ token, role: 'user', username, id: result.insertId, full_name, phone_number: normalizedPhone });
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
    const normalizedPhone = normalizeLebanesePhone(phone_number);
    if (!isValidLebanesePhone(normalizedPhone)) {
      return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
    }

    await db.query(
      'UPDATE users SET username = ?, full_name = ?, phone_number = ? WHERE id = ?',
      [username, full_name, normalizedPhone, req.user.id]
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
