const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { adminMiddleware } = require('../middleware/auth');

const isSubadmin = (req) => req.user?.role === 'subadmin';

const toNumber = (value) => Number(Number(value || 0).toFixed(2));

const normalizePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getAccessibleAdmins = async (req) => {
  const [rows] = await db.query(
    isSubadmin(req)
      ? `SELECT id, username, full_name, role
         FROM admins
         WHERE id = ?`
      : `SELECT id, username, full_name, role
         FROM admins
         WHERE role IN ('admin', 'subadmin')
         ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, COALESCE(NULLIF(full_name, ''), username) ASC`,
    isSubadmin(req) ? [req.user.id] : []
  );

  return rows.map((row) => ({
    id: Number(row.id),
    username: row.username,
    fullName: row.full_name && String(row.full_name).trim() ? String(row.full_name).trim() : row.username,
    role: row.role === 'subadmin' ? 'subadmin' : 'admin'
  }));
};

const resolveScope = (req, requestedAdminId, accessibleAdmins) => {
  if (isSubadmin(req)) {
    return {
      selectedAdminId: req.user.id,
      whereClause: 'WHERE l.admin_id = ?',
      whereParams: [req.user.id]
    };
  }

  if (requestedAdminId) {
    const allowed = accessibleAdmins.some((admin) => admin.id === requestedAdminId);
    if (!allowed) return { error: { status: 404, message: 'Admin not found' } };
    return {
      selectedAdminId: requestedAdminId,
      whereClause: 'WHERE l.admin_id = ?',
      whereParams: [requestedAdminId]
    };
  }

  return {
    selectedAdminId: null,
    whereClause: '',
    whereParams: []
  };
};

router.get('/overview', adminMiddleware, async (req, res) => {
  try {
    const requestedAdminId = normalizePositiveInt(req.query.adminId);
    const accessibleAdmins = await getAccessibleAdmins(req);
    const scope = resolveScope(req, requestedAdminId, accessibleAdmins);
    if (scope.error) {
      return res.status(scope.error.status).json({ message: scope.error.message });
    }

    const [totalRows] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN l.entry_type = 'fund_add' THEN l.amount ELSE 0 END), 0) AS given_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'cashback' THEN l.amount ELSE 0 END), 0) AS cashback_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'number_purchase' THEN l.amount ELSE 0 END), 0) AS spent_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'redeem_applied' THEN l.amount ELSE 0 END), 0) AS redeemed_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'loyalty_code_generated' THEN l.amount ELSE 0 END), 0) AS generated_amount
       FROM admin_report_ledger l
       ${scope.whereClause}`,
      scope.whereParams
    );

    const [byAdminRows] = await db.query(
      `SELECT
         l.admin_id,
         a.username AS admin_username,
         COALESCE(NULLIF(a.full_name, ''), a.username) AS admin_name,
         a.role,
         COALESCE(SUM(CASE WHEN l.entry_type = 'fund_add' THEN l.amount ELSE 0 END), 0) AS given_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'cashback' THEN l.amount ELSE 0 END), 0) AS cashback_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'number_purchase' THEN l.amount ELSE 0 END), 0) AS spent_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'redeem_applied' THEN l.amount ELSE 0 END), 0) AS redeemed_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'loyalty_code_generated' THEN l.amount ELSE 0 END), 0) AS generated_amount,
         COUNT(DISTINCT CASE WHEN l.user_id IS NOT NULL THEN l.user_id END) AS users_count
       FROM admin_report_ledger l
       JOIN admins a ON a.id = l.admin_id
       ${scope.whereClause}
       GROUP BY l.admin_id, a.username, a.full_name, a.role
       ORDER BY admin_name ASC`,
      scope.whereParams
    );

    const givenAmount = toNumber(totalRows[0]?.given_amount);
    const cashbackAmount = toNumber(totalRows[0]?.cashback_amount);

    res.json({
      admins: accessibleAdmins,
      selectedAdminId: scope.selectedAdminId,
      totals: {
        givenAmount,
        cashbackAmount,
        netAmount: toNumber(givenAmount - cashbackAmount),
        numbersSpentAmount: toNumber(totalRows[0]?.spent_amount),
        redeemAppliedAmount: toNumber(totalRows[0]?.redeemed_amount),
        generatedRewardsAmount: toNumber(totalRows[0]?.generated_amount)
      },
      byAdmin: byAdminRows.map((row) => {
        const rowGiven = toNumber(row.given_amount);
        const rowCashback = toNumber(row.cashback_amount);
        return {
          adminId: Number(row.admin_id),
          adminUsername: row.admin_username,
          adminName: row.admin_name,
          role: row.role === 'subadmin' ? 'subadmin' : 'admin',
          usersCount: Number(row.users_count || 0),
          givenAmount: rowGiven,
          cashbackAmount: rowCashback,
          netAmount: toNumber(rowGiven - rowCashback),
          numbersSpentAmount: toNumber(row.spent_amount),
          redeemAppliedAmount: toNumber(row.redeemed_amount),
          generatedRewardsAmount: toNumber(row.generated_amount)
        };
      })
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/user-activity', adminMiddleware, async (req, res) => {
  try {
    const requestedAdminId = normalizePositiveInt(req.query.adminId);
    const requestedUserId = normalizePositiveInt(req.query.userId);
    const rawSearch = String(req.query.search || '').trim();
    const searchLike = rawSearch ? `%${rawSearch}%` : null;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const offset = (page - 1) * limit;

    const accessibleAdmins = await getAccessibleAdmins(req);
    const scope = resolveScope(req, requestedAdminId, accessibleAdmins);
    if (scope.error) {
      return res.status(scope.error.status).json({ message: scope.error.message });
    }

    const summaryConditions = ['l.user_id IS NOT NULL'];
    const summaryParams = [];
    if (scope.selectedAdminId) {
      summaryConditions.push('l.admin_id = ?');
      summaryParams.push(scope.selectedAdminId);
    }
    if (requestedUserId) {
      summaryConditions.push('l.user_id = ?');
      summaryParams.push(requestedUserId);
    }
    if (searchLike) {
      summaryConditions.push('(u.username LIKE ? OR u.full_name LIKE ? OR u.phone_number LIKE ?)');
      summaryParams.push(searchLike, searchLike, searchLike);
    }
    const summaryWhere = `WHERE ${summaryConditions.join(' AND ')}`;

    const [summaryCountRows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM (
         SELECT l.user_id
         FROM admin_report_ledger l
         LEFT JOIN users u ON u.id = l.user_id
         ${summaryWhere}
         GROUP BY l.user_id
       ) grouped_users`,
      summaryParams
    );
    const totalUsers = Number(summaryCountRows[0]?.count || 0);

    const [userSummaryRows] = await db.query(
      `SELECT
         l.user_id,
         u.username,
         u.full_name,
         u.phone_number,
         COALESCE(SUM(CASE WHEN l.entry_type = 'fund_add' THEN l.amount ELSE 0 END), 0) AS given_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'cashback' THEN l.amount ELSE 0 END), 0) AS cashback_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'number_purchase' THEN l.amount ELSE 0 END), 0) AS spent_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'redeem_applied' THEN l.amount ELSE 0 END), 0) AS redeemed_amount,
         COALESCE(SUM(CASE WHEN l.entry_type = 'loyalty_code_generated' THEN l.amount ELSE 0 END), 0) AS generated_amount,
         COUNT(*) AS activity_count,
         MAX(l.created_at) AS last_activity_at
       FROM admin_report_ledger l
       LEFT JOIN users u ON u.id = l.user_id
       ${summaryWhere}
       GROUP BY l.user_id, u.username, u.full_name, u.phone_number
       ORDER BY last_activity_at DESC
       LIMIT ? OFFSET ?`,
      [...summaryParams, limit, offset]
    );

    const activityConditions = [];
    const activityParams = [];
    if (scope.selectedAdminId) {
      activityConditions.push('l.admin_id = ?');
      activityParams.push(scope.selectedAdminId);
    }
    if (requestedUserId) {
      activityConditions.push('l.user_id = ?');
      activityParams.push(requestedUserId);
    }
    if (searchLike) {
      activityConditions.push('(u.username LIKE ? OR u.full_name LIKE ? OR u.phone_number LIKE ?)');
      activityParams.push(searchLike, searchLike, searchLike);
    }
    const activityWhere = activityConditions.length ? `WHERE ${activityConditions.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM admin_report_ledger l
       LEFT JOIN users u ON u.id = l.user_id
       ${activityWhere}`,
      activityParams
    );
    const totalActivities = Number(countRows[0]?.count || 0);

    const [activityRows] = await db.query(
      `SELECT
         l.id,
         l.admin_id,
         l.actor_admin_id,
         l.user_id,
         l.pull_id,
         l.pull_number,
         l.entry_type,
         l.amount,
         l.note,
         l.created_at,
         u.username,
         u.full_name,
         u.phone_number,
         p.title AS pull_title,
         a.username AS admin_username,
         COALESCE(NULLIF(a.full_name, ''), a.username) AS admin_name,
         actor.username AS actor_username,
         COALESCE(NULLIF(actor.full_name, ''), actor.username) AS actor_name
       FROM admin_report_ledger l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN pulls p ON p.id = l.pull_id
       LEFT JOIN admins a ON a.id = l.admin_id
       LEFT JOIN admins actor ON actor.id = l.actor_admin_id
       ${activityWhere}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [...activityParams, limit, offset]
    );

    res.json({
      admins: accessibleAdmins,
      selectedAdminId: scope.selectedAdminId,
      page,
      limit,
      total: totalUsers,
      totalUsers,
      totalActivities,
      search: rawSearch,
      users: userSummaryRows.map((row) => {
        const givenAmount = toNumber(row.given_amount);
        const cashbackAmount = toNumber(row.cashback_amount);
        return {
          userId: Number(row.user_id),
          username: row.username,
          fullName: row.full_name,
          phoneNumber: row.phone_number,
          givenAmount,
          cashbackAmount,
          netAmount: toNumber(givenAmount - cashbackAmount),
          numbersSpentAmount: toNumber(row.spent_amount),
          redeemAppliedAmount: toNumber(row.redeemed_amount),
          generatedRewardsAmount: toNumber(row.generated_amount),
          activityCount: Number(row.activity_count || 0),
          lastActivityAt: row.last_activity_at
        };
      }),
      activities: activityRows.map((row) => ({
        id: Number(row.id),
        adminId: Number(row.admin_id),
        adminName: row.admin_name,
        adminUsername: row.admin_username,
        actorAdminId: row.actor_admin_id ? Number(row.actor_admin_id) : null,
        actorName: row.actor_name || null,
        actorUsername: row.actor_username || null,
        userId: row.user_id ? Number(row.user_id) : null,
        username: row.username || null,
        fullName: row.full_name || null,
        phoneNumber: row.phone_number || null,
        pullId: row.pull_id ? Number(row.pull_id) : null,
        pullTitle: row.pull_title || null,
        pullNumber: row.pull_number !== null && row.pull_number !== undefined ? Number(row.pull_number) : null,
        entryType: row.entry_type,
        amount: toNumber(row.amount),
        note: row.note || null,
        createdAt: row.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
