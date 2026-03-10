const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Get all pulls
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [pulls] = await db.query('SELECT * FROM pulls ORDER BY created_at DESC');
    res.json(pulls);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get single pull with numbers
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [pulls] = await db.query('SELECT * FROM pulls WHERE id = ?', [req.params.id]);
    if (!pulls.length) return res.status(404).json({ message: 'Pull not found' });

    const [numbers] = await db.query(
      `SELECT pn.*, u.username, u.full_name, u.phone_number
       FROM pull_numbers pn 
       LEFT JOIN users u ON pn.user_id = u.id 
       WHERE pn.pull_id = ? ORDER BY pn.number`,
      [req.params.id]
    );

    let allowedAttempts = 0;
    let usedAttempts = 0;
    let remainingAttempts = 0;
    if (req.user.role === 'user') {
      const [attempts] = await db.query(
        'SELECT attempts FROM user_pull_attempts WHERE user_id = ? AND pull_id = ?',
        [req.user.id, req.params.id]
      );
      allowedAttempts = attempts.length ? attempts[0].attempts : 0;

      const [usedRows] = await db.query(
        'SELECT COUNT(*) as count FROM pull_numbers WHERE pull_id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      usedAttempts = usedRows[0]?.count || 0;
      remainingAttempts = Math.max(allowedAttempts - usedAttempts, 0);
    }

    res.json({
      pull: pulls[0],
      numbers,
      allowedAttempts,
      usedAttempts,
      remainingAttempts,
      userAttempts: allowedAttempts
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create pull (admin)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { title, description, admin_phone } = req.body;
    let photo_url = null;

    if (req.files && req.files.photo) {
      const photo = req.files.photo;
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `${Date.now()}-${photo.name}`;
      await photo.mv(path.join(uploadDir, filename));
      photo_url = `/uploads/${filename}`;
    }

    let finalAdminPhone = admin_phone;
    if (!finalAdminPhone || !String(finalAdminPhone).trim()) {
      const [admins] = await db.query('SELECT phone_number FROM admins WHERE id = ?', [req.user.id]);
      finalAdminPhone = admins[0]?.phone_number || null;
    }

    const [result] = await db.query(
      'INSERT INTO pulls (title, description, photo_url, admin_phone) VALUES (?, ?, ?, ?)',
      [title, description, photo_url, finalAdminPhone]
    );

    // Allocate 100 random Arabic names to numbers 00-99
    const [allNames] = await db.query('SELECT name FROM arabic_names ORDER BY RAND() LIMIT 100');
    const insertNumbers = [];
    for (let i = 0; i <= 99; i++) {
      insertNumbers.push([result.insertId, i, allNames[i].name]);
    }
    await db.query('INSERT INTO pull_numbers (pull_id, number, arabic_name) VALUES ?', [insertNumbers]);

    res.json({ message: 'Pull created successfully', id: result.insertId });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update pull (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { title, description, admin_phone, status } = req.body;
    let photo_url = undefined;

    if (req.files && req.files.photo) {
      const photo = req.files.photo;
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `${Date.now()}-${photo.name}`;
      await photo.mv(path.join(uploadDir, filename));
      photo_url = `/uploads/${filename}`;
    }

    const updates = [];
    const values = [];
    if (title !== undefined)       { updates.push('title = ?');       values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (photo_url !== undefined)   { updates.push('photo_url = ?');   values.push(photo_url); }
    if (admin_phone !== undefined) { updates.push('admin_phone = ?'); values.push(admin_phone); }
    if (status !== undefined)      { updates.push('status = ?');      values.push(status); }

    values.push(req.params.id);
    await db.query(`UPDATE pulls SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Pull updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete pull (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const pullId = req.params.id;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM pull_history WHERE pull_id = ?', [pullId]);
      await conn.query('DELETE FROM pulls WHERE id = ?', [pullId]);
      await conn.commit();
      res.json({ message: 'Pull deleted successfully' });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ message: err.message });
    } finally {
      conn.release();
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Reserve a number (user)
router.post('/:id/reserve', authMiddleware, async (req, res) => {
  try {
    const { number } = req.body;
    const pullId = req.params.id;
    const userId = req.user.id;

    const [pulls] = await db.query('SELECT * FROM pulls WHERE id = ? AND status = "active"', [pullId]);
    if (!pulls.length) return res.status(400).json({ message: 'Pull is not active' });

    // Check number availability
    const [numRow] = await db.query(
      'SELECT * FROM pull_numbers WHERE pull_id = ? AND number = ?',
      [pullId, number]
    );
    if (!numRow.length) return res.status(404).json({ message: 'Number not found' });
    if (numRow[0].user_id) return res.status(400).json({ message: 'Number already taken' });

    const [attempts] = await db.query(
      'SELECT attempts FROM user_pull_attempts WHERE user_id = ? AND pull_id = ?',
      [userId, pullId]
    );
    const allowedAttempts = attempts.length ? attempts[0].attempts : 0;
    const [usedRows] = await db.query(
      'SELECT COUNT(*) as count FROM pull_numbers WHERE pull_id = ? AND user_id = ?',
      [pullId, userId]
    );
    const usedAttempts = usedRows[0]?.count || 0;
    if (usedAttempts >= allowedAttempts) {
      return res.status(400).json({ message: 'No attempts remaining' });
    }

    // Reserve
    await db.query(
      'UPDATE pull_numbers SET user_id = ?, reserved_at = NOW() WHERE pull_id = ? AND number = ?',
      [userId, pullId, number]
    );

    res.json({ message: 'Number reserved successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Set winner (admin)
router.post('/:id/winner', adminMiddleware, async (req, res) => {
  try {
    const { winner_number } = req.body;
    const pullId = req.params.id;

    const [numRow] = await db.query(
      'SELECT pn.*, u.id as uid, u.full_name, u.username FROM pull_numbers pn LEFT JOIN users u ON pn.user_id = u.id WHERE pn.pull_id = ? AND pn.number = ?',
      [pullId, winner_number]
    );
    if (!numRow.length) return res.status(404).json({ message: 'Number not found' });

    const winner = numRow[0];
    await db.query('UPDATE pulls SET winner_number = ?, status = "completed" WHERE id = ?', [winner_number, pullId]);
    await db.query(
      'INSERT INTO pull_history (pull_id, winner_user_id, winner_number) VALUES (?, ?, ?)',
      [pullId, winner.uid || null, winner_number]
    );

    req.app.get('io').to(`pull_${pullId}`).emit('winner_announced', {
      pullId, winnerNumber: winner_number,
      winnerName: winner.arabic_name,
      winnerUser: winner.full_name || 'No owner',
      winnerUsername: winner.username || null
    });

    res.json({ message: 'Winner announced', winner });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
