const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const { normalizeLebanesePhone, isValidLebanesePhone } = require('../utils/phone');

const isSubadmin = (req) => req.user?.role === 'subadmin';
const LOYALTY_REDEEM_UNIT = 5;
const safeInsertReportEntry = async (conn, values) => {
  try {
    await conn.query(
      `INSERT INTO admin_report_ledger (admin_id, user_id, pull_id, pull_number, entry_type, amount, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  } catch (err) {
    console.warn('Report ledger insert skipped:', err.message);
  }
};
const getMainAdminId = async (queryable) => {
  const [rows] = await queryable.query(
    "SELECT id FROM admins WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
  );
  return Number(rows[0]?.id || 0);
};
const createRedeemCode = (adminId, userId) => {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `R${adminId}U${userId}-${stamp}${randomPart}`;
};
const insertRedeemCode = async (conn, { userId, adminId, amount, maxRetries = 5 }) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = createRedeemCode(adminId, userId);
    try {
      await conn.query(
        'INSERT INTO loyalty_redeem_codes (code, user_id, admin_id, amount, status) VALUES (?, ?, ?, ?, ?)',
        [code, userId, adminId, amount, 'available']
      );
      return code;
    } catch (err) {
      if (err?.code !== 'ER_DUP_ENTRY') {
        throw err;
      }
    }
  }
  throw new Error('Failed to generate unique redeem code');
};

// Get all pulls
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = `SELECT p.*,
                        COALESCE(a.loyalty_percentage, 0) AS loyalty_percentage,
                        COALESCE(NULLIF(a.full_name, ''), a.username) AS admin_name,
                        a.username AS admin_username
                 FROM pulls p
                 LEFT JOIN admins a ON a.id = p.created_by_admin_id`;
    const values = [];
    if (isSubadmin(req)) {
      query += ' WHERE p.created_by_admin_id = ?';
      values.push(req.user.id);
    }
    query += ' ORDER BY p.created_at DESC';
    const [pulls] = await db.query(query, values);
    res.json(pulls);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get single pull with numbers
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const pullQuery = isSubadmin(req)
      ? `SELECT p.*, COALESCE(a.loyalty_percentage, 0) AS loyalty_percentage, a.username AS owner_admin_username
         FROM pulls p
         LEFT JOIN admins a ON a.id = p.created_by_admin_id
         WHERE p.id = ? AND p.created_by_admin_id = ?`
      : `SELECT p.*, COALESCE(a.loyalty_percentage, 0) AS loyalty_percentage, a.username AS owner_admin_username
         FROM pulls p
         LEFT JOIN admins a ON a.id = p.created_by_admin_id
         WHERE p.id = ?`;
    const pullValues = isSubadmin(req) ? [req.params.id, req.user.id] : [req.params.id];
    const [pulls] = await db.query(pullQuery, pullValues);
    if (!pulls.length) return res.status(404).json({ message: 'Pull not found' });

    const [numbers] = await db.query(
      `SELECT pn.*, u.username, u.full_name, u.phone_number
       FROM pull_numbers pn 
       LEFT JOIN users u ON pn.user_id = u.id 
       WHERE pn.pull_id = ? ORDER BY pn.number`,
      [req.params.id]
    );

    const ownerAdminId = Number(pulls[0]?.created_by_admin_id || 0);
    const ownerLoyaltyPercentage = Number(pulls[0]?.loyalty_percentage || 0);
    const ownerAdminName = pulls[0]?.owner_admin_username || null;
    const nextRewardAmount = ownerLoyaltyPercentage > 0 ? LOYALTY_REDEEM_UNIT : 0;
    const mainAdminId = await getMainAdminId(db);
    const totalScopeAdminIds = [];
    if (ownerAdminId > 0) totalScopeAdminIds.push(ownerAdminId);
    if (mainAdminId > 0 && mainAdminId !== ownerAdminId) totalScopeAdminIds.push(mainAdminId);

    let totalGivenMoney = 0;
    if (totalScopeAdminIds.length > 0) {
      const placeholders = totalScopeAdminIds.map(() => '?').join(', ');
      const [givenMoneyRows] = await db.query(
        `SELECT COALESCE(SUM(balance + loyalty_balance), 0) AS total FROM user_admin_wallets WHERE admin_id IN (${placeholders})`,
        totalScopeAdminIds
      );
      totalGivenMoney = Number(givenMoneyRows[0]?.total || 0);
    }

    let currentBalance = 0;
    let usedNumbers = 0;
    let affordableNumbers = 0;
    let loyalty = {
      adminId: ownerAdminId,
      adminName: ownerAdminName,
      percentage: ownerLoyaltyPercentage,
      spendTarget: LOYALTY_REDEEM_UNIT,
      spendProgress: 0,
      pendingReward: 0,
      nextRewardAmount,
      availableCodesCount: 0,
      availableCodesAmount: 0
    };
    let availableRedeemCodes = [];
    if (req.user.role === 'user') {
      const walletScopeAdminIds = [];
      if (ownerAdminId > 0) walletScopeAdminIds.push(ownerAdminId);
      if (mainAdminId > 0 && mainAdminId !== ownerAdminId) walletScopeAdminIds.push(mainAdminId);

      if (walletScopeAdminIds.length > 0) {
        const placeholders = walletScopeAdminIds.map(() => '?').join(', ');
        const [fundRows] = await db.query(
          `SELECT admin_id, balance, loyalty_balance FROM user_admin_wallets WHERE user_id = ? AND admin_id IN (${placeholders})`,
          [req.user.id, ...walletScopeAdminIds]
        );
        const ownerWallet = fundRows.find((r) => Number(r.admin_id) === ownerAdminId);
        const mainWallet = fundRows.find((r) => Number(r.admin_id) === mainAdminId);
        const ownerRegular = Number(ownerWallet?.balance || 0);
        const ownerLoyalty = Number(ownerWallet?.loyalty_balance || 0);
        const mainRegular = Number(mainWallet?.balance || 0);
        currentBalance = ownerRegular + ownerLoyalty + (mainAdminId !== ownerAdminId ? mainRegular : 0);
      }

      const [usedRows] = await db.query(
        'SELECT COUNT(*) as count FROM pull_numbers WHERE pull_id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      usedNumbers = Number(usedRows[0]?.count || 0);

      const pricePerNumber = Number.parseFloat(pulls[0]?.attempt_price || 0);
      affordableNumbers = pricePerNumber > 0 ? Math.floor(currentBalance / pricePerNumber) : 0;

      if (ownerAdminId > 0) {
        const [loyaltyRows] = await db.query(
          'SELECT spend_carry FROM user_admin_loyalty WHERE user_id = ? AND admin_id = ?',
          [req.user.id, ownerAdminId]
        );
        const pendingReward = Number(loyaltyRows[0]?.spend_carry || 0);

        const [codeSummaryRows] = await db.query(
          `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
           FROM loyalty_redeem_codes
           WHERE user_id = ? AND admin_id = ? AND status = 'available'`,
          [req.user.id, ownerAdminId]
        );
        const availableCodesCount = Number(codeSummaryRows[0]?.count || 0);
        const availableCodesAmount = Number(codeSummaryRows[0]?.total || 0);

        const [codeRows] = await db.query(
          `SELECT code, amount, created_at
           FROM loyalty_redeem_codes
           WHERE user_id = ? AND admin_id = ? AND status = 'available'
           ORDER BY created_at ASC`,
          [req.user.id, ownerAdminId]
        );

        availableRedeemCodes = codeRows.map((row) => ({
          code: row.code,
          amount: Number(row.amount || 0),
          created_at: row.created_at
        }));

        loyalty = {
          ...loyalty,
          spendProgress: pendingReward,
          pendingReward,
          availableCodesCount,
          availableCodesAmount
        };
      }
    }

    res.json({
      pull: pulls[0],
      numbers,
      totalGivenMoney,
      currentBalance,
      usedNumbers,
      affordableNumbers,
      loyalty,
      availableRedeemCodes,
      // Backward-compatible aliases (legacy attempt-based UI fields)
      totalGivenAttempts: totalGivenMoney,
      allowedAttempts: currentBalance,
      usedAttempts: usedNumbers,
      remainingAttempts: affordableNumbers,
      userAttempts: currentBalance
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Create pull (admin)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { title, description, admin_phone, attempt_price } = req.body;
    const attemptPrice = Number.parseFloat(attempt_price);
    if (!Number.isFinite(attemptPrice) || attemptPrice <= 0) {
      return res.status(400).json({ message: 'Attempt price must be a positive number' });
    }
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
    const normalizedAdminPhone = normalizeLebanesePhone(finalAdminPhone);
    if (!isValidLebanesePhone(normalizedAdminPhone)) {
      return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
    }

    const [result] = await db.query(
      'INSERT INTO pulls (title, description, photo_url, admin_phone, attempt_price, created_by_admin_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, photo_url, normalizedAdminPhone, attemptPrice, req.user.id]
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
    const { title, description, admin_phone, status, attempt_price } = req.body;
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
    if (admin_phone !== undefined) {
      const normalizedAdminPhone = normalizeLebanesePhone(admin_phone);
      if (!isValidLebanesePhone(normalizedAdminPhone)) {
        return res.status(400).json({ message: 'Phone number must be in format +961XXXXXXXX' });
      }
      updates.push('admin_phone = ?');
      values.push(normalizedAdminPhone);
    }
    if (status !== undefined)      { updates.push('status = ?');      values.push(status); }
    if (attempt_price !== undefined) {
      const attemptPrice = Number.parseFloat(attempt_price);
      if (!Number.isFinite(attemptPrice) || attemptPrice <= 0) {
        return res.status(400).json({ message: 'Attempt price must be a positive number' });
      }
      updates.push('attempt_price = ?');
      values.push(attemptPrice);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    let updateQuery = `UPDATE pulls SET ${updates.join(', ')} WHERE id = ?`;
    values.push(req.params.id);
    if (isSubadmin(req)) {
      updateQuery += ' AND created_by_admin_id = ?';
      values.push(req.user.id);
    }

    const [result] = await db.query(updateQuery, values);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Pull not found' });
    }
    res.json({ message: 'Pull updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete pull (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const pullId = req.params.id;
    const ownPullQuery = isSubadmin(req)
      ? 'SELECT id FROM pulls WHERE id = ? AND created_by_admin_id = ?'
      : 'SELECT id FROM pulls WHERE id = ?';
    const ownPullValues = isSubadmin(req) ? [pullId, req.user.id] : [pullId];
    const [pullRows] = await db.query(ownPullQuery, ownPullValues);
    if (!pullRows.length) return res.status(404).json({ message: 'Pull not found' });

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
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'User access required' });
    }
    const { number } = req.body;
    const pullId = req.params.id;
    const userId = req.user.id;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [pullRows] = await conn.query(
        'SELECT id, status, attempt_price, created_by_admin_id FROM pulls WHERE id = ? FOR UPDATE',
        [pullId]
      );
      if (!pullRows.length || pullRows[0].status !== 'active') {
        await conn.rollback();
        return res.status(400).json({ message: 'Pull is not active' });
      }

      const pricePerNumber = Number.parseFloat(pullRows[0].attempt_price || 0);
      if (!Number.isFinite(pricePerNumber) || pricePerNumber <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid pull price' });
      }
      const ownerAdminId = Number(pullRows[0]?.created_by_admin_id || 0);
      if (!ownerAdminId) {
        await conn.rollback();
        return res.status(400).json({ message: 'Pull owner is not configured' });
      }
      const mainAdminId = await getMainAdminId(conn);

      const walletScopeAdminIds = [ownerAdminId];
      if (mainAdminId > 0 && mainAdminId !== ownerAdminId) walletScopeAdminIds.push(mainAdminId);

      const [numRows] = await conn.query(
        'SELECT user_id FROM pull_numbers WHERE pull_id = ? AND number = ? FOR UPDATE',
        [pullId, number]
      );
      if (!numRows.length) {
        await conn.rollback();
        return res.status(404).json({ message: 'Number not found' });
      }
      if (numRows[0].user_id) {
        await conn.rollback();
        return res.status(400).json({ message: 'Number already taken' });
      }

      const walletPlaceholders = walletScopeAdminIds.map(() => '?').join(', ');
      const [fundRows] = await conn.query(
        `SELECT admin_id, balance, loyalty_balance
         FROM user_admin_wallets
         WHERE user_id = ? AND admin_id IN (${walletPlaceholders})
         FOR UPDATE`,
        [userId, ...walletScopeAdminIds]
      );
      const ownerWallet = fundRows.find((r) => Number(r.admin_id) === ownerAdminId);
      const mainWallet = fundRows.find((r) => Number(r.admin_id) === mainAdminId);
      const ownerRegularBalance = Number(ownerWallet?.balance || 0);
      const ownerLoyaltyBalance = Number(ownerWallet?.loyalty_balance || 0);
      const mainRegularBalance = Number(mainWallet?.balance || 0);
      const currentBalance = ownerRegularBalance + ownerLoyaltyBalance + (mainAdminId !== ownerAdminId ? mainRegularBalance : 0);
      if (currentBalance < pricePerNumber) {
        await conn.rollback();
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      const [reserveResult] = await conn.query(
        'UPDATE pull_numbers SET user_id = ?, reserved_at = NOW() WHERE pull_id = ? AND number = ? AND user_id IS NULL',
        [userId, pullId, number]
      );
      if (!reserveResult.affectedRows) {
        await conn.rollback();
        return res.status(400).json({ message: 'Number already taken' });
      }

      let remainingToDeduct = Number(pricePerNumber.toFixed(2));

      const deductFromOwnerRegular = Math.min(ownerRegularBalance, remainingToDeduct);
      if (deductFromOwnerRegular > 0) {
        const [ownerDeductResult] = await conn.query(
          'UPDATE user_admin_wallets SET balance = balance - ? WHERE user_id = ? AND admin_id = ? AND balance >= ?',
          [deductFromOwnerRegular, userId, ownerAdminId, deductFromOwnerRegular]
        );
        if (!ownerDeductResult.affectedRows) {
          await conn.rollback();
          return res.status(400).json({ message: 'Insufficient balance' });
        }
        remainingToDeduct = Number((remainingToDeduct - deductFromOwnerRegular).toFixed(2));
      }

      const deductFromOwnerLoyalty = Math.min(ownerLoyaltyBalance, remainingToDeduct);
      if (deductFromOwnerLoyalty > 0) {
        const [ownerLoyaltyDeductResult] = await conn.query(
          'UPDATE user_admin_wallets SET loyalty_balance = loyalty_balance - ? WHERE user_id = ? AND admin_id = ? AND loyalty_balance >= ?',
          [deductFromOwnerLoyalty, userId, ownerAdminId, deductFromOwnerLoyalty]
        );
        if (!ownerLoyaltyDeductResult.affectedRows) {
          await conn.rollback();
          return res.status(400).json({ message: 'Insufficient balance' });
        }
        remainingToDeduct = Number((remainingToDeduct - deductFromOwnerLoyalty).toFixed(2));
      }

      if (remainingToDeduct > 0) {
        if (mainAdminId <= 0 || mainAdminId === ownerAdminId) {
          await conn.rollback();
          return res.status(400).json({ message: 'Insufficient balance' });
        }
        const [mainDeductResult] = await conn.query(
          'UPDATE user_admin_wallets SET balance = balance - ? WHERE user_id = ? AND admin_id = ? AND balance >= ?',
          [remainingToDeduct, userId, mainAdminId, remainingToDeduct]
        );
        if (!mainDeductResult.affectedRows) {
          await conn.rollback();
          return res.status(400).json({ message: 'Insufficient balance' });
        }
      }

      await safeInsertReportEntry(conn, [
        ownerAdminId,
        userId,
        pullId,
        Number.parseInt(number, 10),
        'number_purchase',
        Number(pricePerNumber.toFixed(2)),
        `Reserved number ${String(number).padStart(2, '0')}`
      ]);

      let generatedCodes = [];
      let generatedRewardAmount = 0;
      const [ownerAdminRows] = await conn.query(
        'SELECT loyalty_percentage FROM admins WHERE id = ? FOR UPDATE',
        [ownerAdminId]
      );
      const loyaltyPercentage = Number(ownerAdminRows[0]?.loyalty_percentage || 0);
      const earnedReward = loyaltyPercentage > 0
        ? Number(((pricePerNumber * loyaltyPercentage) / 100).toFixed(4))
        : 0;

      if (loyaltyPercentage > 0 && earnedReward > 0) {
        await conn.query(
          `INSERT INTO user_admin_loyalty (user_id, admin_id)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
          [userId, ownerAdminId]
        );

        const [loyaltyRows] = await conn.query(
          'SELECT spend_carry FROM user_admin_loyalty WHERE user_id = ? AND admin_id = ? FOR UPDATE',
          [userId, ownerAdminId]
        );
        const rewardCarry = Number(loyaltyRows[0]?.spend_carry || 0);
        const accumulatedReward = Number((rewardCarry + earnedReward).toFixed(4));
        const redeemableAmount = Number((Math.floor(accumulatedReward / LOYALTY_REDEEM_UNIT) * LOYALTY_REDEEM_UNIT).toFixed(2));
        const nextCarry = Number((accumulatedReward - redeemableAmount).toFixed(4));

        await conn.query(
          `UPDATE user_admin_loyalty
           SET spend_carry = ?,
               total_spent = total_spent + ?,
               total_rewards_generated = total_rewards_generated + ?
           WHERE user_id = ? AND admin_id = ?`,
          [nextCarry, pricePerNumber, redeemableAmount, userId, ownerAdminId]
        );

        if (redeemableAmount > 0) {
          generatedRewardAmount = redeemableAmount;
          const code = await insertRedeemCode(conn, {
            userId,
            adminId: ownerAdminId,
            amount: redeemableAmount
          });
          generatedCodes.push(code);

          await safeInsertReportEntry(conn, [
            ownerAdminId,
            userId,
            pullId,
            null,
            'loyalty_code_generated',
            Number(redeemableAmount.toFixed(2)),
            `Generated redeem code ${code}`
          ]);
        }
      }

      await conn.commit();
      res.json({
        message: 'Number reserved successfully',
        loyaltyCodesGenerated: generatedCodes.length,
        loyaltyAmountGenerated: generatedRewardAmount
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ message: err.message });
    } finally {
      conn.release();
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Redeem loyalty code for a specific pull owner
router.post('/:id/redeem-code', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'User access required' });
    }

    const { code } = req.body;
    const pullId = req.params.id;
    const userId = req.user.id;
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return res.status(400).json({ message: 'Redeem code is required' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [pullRows] = await conn.query(
        'SELECT id, created_by_admin_id FROM pulls WHERE id = ? FOR UPDATE',
        [pullId]
      );
      if (!pullRows.length) {
        await conn.rollback();
        return res.status(404).json({ message: 'Pull not found' });
      }
      const ownerAdminId = Number(pullRows[0]?.created_by_admin_id || 0);
      if (!ownerAdminId) {
        await conn.rollback();
        return res.status(400).json({ message: 'Pull owner is not configured' });
      }

      const [codeRows] = await conn.query(
        `SELECT id, admin_id, amount, status
         FROM loyalty_redeem_codes
         WHERE code = ? AND user_id = ?
         FOR UPDATE`,
        [normalizedCode, userId]
      );
      if (!codeRows.length) {
        await conn.rollback();
        return res.status(404).json({ message: 'Invalid redeem code' });
      }

      const redeemRow = codeRows[0];
      if (redeemRow.status !== 'available') {
        await conn.rollback();
        return res.status(400).json({ message: 'Redeem code already used' });
      }
      if (Number(redeemRow.admin_id) !== ownerAdminId) {
        await conn.rollback();
        return res.status(400).json({ message: 'This code belongs to another admin' });
      }

      const redeemAmount = Number(redeemRow.amount || 0);
      if (!Number.isFinite(redeemAmount) || redeemAmount <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid redeem amount' });
      }

      await conn.query(
        `UPDATE loyalty_redeem_codes
         SET status = 'redeemed', redeemed_at = NOW(), redeemed_pull_id = ?
         WHERE id = ?`,
        [pullId, redeemRow.id]
      );

      await conn.query(
        `INSERT INTO user_admin_wallets (user_id, admin_id, loyalty_balance)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE loyalty_balance = loyalty_balance + VALUES(loyalty_balance)`,
        [userId, ownerAdminId, redeemAmount]
      );

      await conn.query(
        `INSERT INTO user_admin_loyalty (user_id, admin_id, total_rewards_redeemed)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE total_rewards_redeemed = total_rewards_redeemed + VALUES(total_rewards_redeemed)`,
        [userId, ownerAdminId, redeemAmount]
      );

      await safeInsertReportEntry(conn, [
        ownerAdminId,
        userId,
        pullId,
        null,
        'redeem_applied',
        redeemAmount,
        `Redeem code ${normalizedCode}`
      ]);

      const [walletRows] = await conn.query(
        'SELECT balance, loyalty_balance FROM user_admin_wallets WHERE user_id = ? AND admin_id = ?',
        [userId, ownerAdminId]
      );
      const updatedOwnerWalletBalance = Number(walletRows[0]?.balance || 0) + Number(walletRows[0]?.loyalty_balance || 0);

      await conn.commit();
      res.json({
        message: 'Redeem code applied successfully',
        amountAdded: redeemAmount,
        ownerWalletBalance: updatedOwnerWalletBalance
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ message: err.message });
    } finally {
      conn.release();
    }
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Set winner (admin)
router.post('/:id/winner', adminMiddleware, async (req, res) => {
  try {
    const { winner_number } = req.body;
    const pullId = req.params.id;

    const ownPullQuery = isSubadmin(req)
      ? 'SELECT id FROM pulls WHERE id = ? AND created_by_admin_id = ?'
      : 'SELECT id FROM pulls WHERE id = ?';
    const ownPullValues = isSubadmin(req) ? [pullId, req.user.id] : [pullId];
    const [pullRows] = await db.query(ownPullQuery, ownPullValues);
    if (!pullRows.length) return res.status(404).json({ message: 'Pull not found' });

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
