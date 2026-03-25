const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDb() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await connection.query(sql);

  const [adminPhoneCol] = await connection.query("SHOW COLUMNS FROM admins LIKE 'phone_number'");
  if (!adminPhoneCol.length) {
    await connection.query('ALTER TABLE admins ADD COLUMN phone_number VARCHAR(20)');
  }

  const [adminFullNameCol] = await connection.query("SHOW COLUMNS FROM admins LIKE 'full_name'");
  if (!adminFullNameCol.length) {
    await connection.query('ALTER TABLE admins ADD COLUMN full_name VARCHAR(100) AFTER username');
  }
  await connection.query("UPDATE admins SET full_name = username WHERE full_name IS NULL OR TRIM(full_name) = ''");

  const [adminRoleCol] = await connection.query("SHOW COLUMNS FROM admins LIKE 'role'");
  if (!adminRoleCol.length) {
    await connection.query("ALTER TABLE admins ADD COLUMN role ENUM('admin','subadmin') NOT NULL DEFAULT 'admin' AFTER password");
  }

  const [adminLoyaltyCol] = await connection.query("SHOW COLUMNS FROM admins LIKE 'loyalty_percentage'");
  if (!adminLoyaltyCol.length) {
    await connection.query('ALTER TABLE admins ADD COLUMN loyalty_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER phone_number');
  }

  const [attemptPriceCol] = await connection.query("SHOW COLUMNS FROM pulls LIKE 'attempt_price'");
  if (!attemptPriceCol.length) {
    await connection.query('ALTER TABLE pulls ADD COLUMN attempt_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER admin_phone');
  }

  const [createdByAdminCol] = await connection.query("SHOW COLUMNS FROM pulls LIKE 'created_by_admin_id'");
  if (!createdByAdminCol.length) {
    await connection.query('ALTER TABLE pulls ADD COLUMN created_by_admin_id INT NULL AFTER attempt_price');
  }

  const [pullsCreatorIdx] = await connection.query("SHOW INDEX FROM pulls WHERE Key_name = 'idx_pulls_creator'");
  if (!pullsCreatorIdx.length) {
    await connection.query('ALTER TABLE pulls ADD INDEX idx_pulls_creator (created_by_admin_id)');
  }

  const [pullsCreatorFk] = await connection.query(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'pulls'
      AND COLUMN_NAME = 'created_by_admin_id'
      AND REFERENCED_TABLE_NAME = 'admins'
      AND REFERENCED_COLUMN_NAME = 'id'
  `);
  if (!pullsCreatorFk.length) {
    await connection.query(`
      ALTER TABLE pulls
      ADD CONSTRAINT fk_pulls_creator_admin
      FOREIGN KEY (created_by_admin_id) REFERENCES admins(id)
      ON DELETE SET NULL
    `);
  }

  const [mainAdminRows] = await connection.query("SELECT id FROM admins WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  if (mainAdminRows.length) {
    await connection.query('UPDATE pulls SET created_by_admin_id = ? WHERE created_by_admin_id IS NULL', [mainAdminRows[0].id]);
  }

  const [fundBalanceCol] = await connection.query("SHOW COLUMNS FROM user_pull_attempts LIKE 'balance'");
  if (!fundBalanceCol.length) {
    await connection.query('ALTER TABLE user_pull_attempts ADD COLUMN balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER attempts');
  }
  await connection.query('UPDATE user_pull_attempts SET balance = attempts WHERE balance = 0 AND attempts > 0');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_admin_wallets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      admin_id INT NOT NULL,
      balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      loyalty_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_admin_wallet (user_id, admin_id),
      INDEX idx_wallet_admin (admin_id),
      INDEX idx_wallet_user (user_id)
    )
  `);

  const [walletLoyaltyCol] = await connection.query("SHOW COLUMNS FROM user_admin_wallets LIKE 'loyalty_balance'");
  if (!walletLoyaltyCol.length) {
    await connection.query('ALTER TABLE user_admin_wallets ADD COLUMN loyalty_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER balance');
  }

  const [walletCountRows] = await connection.query('SELECT COUNT(*) AS count FROM user_admin_wallets');
  const walletCount = Number(walletCountRows[0]?.count || 0);
  if (walletCount === 0) {
    await connection.query(`
      INSERT INTO user_admin_wallets (user_id, admin_id, balance)
      SELECT upa.user_id,
             p.created_by_admin_id,
             SUM(COALESCE(upa.balance, upa.attempts, 0)) AS total_balance
      FROM user_pull_attempts upa
      JOIN pulls p ON p.id = upa.pull_id
      WHERE p.created_by_admin_id IS NOT NULL
      GROUP BY upa.user_id, p.created_by_admin_id
      HAVING SUM(COALESCE(upa.balance, upa.attempts, 0)) > 0
    `);
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_admin_loyalty (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      admin_id INT NOT NULL,
      spend_carry DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_spent DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total_rewards_generated DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total_rewards_redeemed DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_admin_loyalty (user_id, admin_id),
      INDEX idx_loyalty_user (user_id),
      INDEX idx_loyalty_admin (admin_id)
    )
  `);

  // Legacy migration:
  // older logic stored spend remainder (0..99) in spend_carry.
  // new logic stores reward remainder (< LOYALTY_REDEEM_UNIT).
  // convert only rows that are clearly in legacy format.
  await connection.query(`
    UPDATE user_admin_loyalty l
    JOIN admins a ON a.id = l.admin_id
    SET l.spend_carry = ROUND((l.spend_carry * COALESCE(a.loyalty_percentage, 0)) / 100, 4)
    WHERE l.spend_carry >= 5
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS loyalty_redeem_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(40) NOT NULL UNIQUE,
      user_id INT NOT NULL,
      admin_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('available', 'redeemed') NOT NULL DEFAULT 'available',
      redeemed_pull_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      redeemed_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      FOREIGN KEY (redeemed_pull_id) REFERENCES pulls(id) ON DELETE SET NULL,
      INDEX idx_redeem_lookup (user_id, admin_id, status),
      INDEX idx_redeem_admin (admin_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS admin_report_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      actor_admin_id INT NULL,
      user_id INT NULL,
      pull_id INT NULL,
      pull_number INT NULL,
      entry_type ENUM('fund_add','cashback','number_purchase','redeem_applied','loyalty_code_generated') NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_admin_id) REFERENCES admins(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (pull_id) REFERENCES pulls(id) ON DELETE SET NULL,
      INDEX idx_report_admin_created (admin_id, created_at),
      INDEX idx_report_admin_user_created (admin_id, user_id, created_at),
      INDEX idx_report_type_created (entry_type, created_at)
    )
  `);

  const [reportActorAdminCol] = await connection.query("SHOW COLUMNS FROM admin_report_ledger LIKE 'actor_admin_id'");
  if (!reportActorAdminCol.length) {
    await connection.query('ALTER TABLE admin_report_ledger ADD COLUMN actor_admin_id INT NULL AFTER admin_id');
  }

  const [reportPullNumberCol] = await connection.query("SHOW COLUMNS FROM admin_report_ledger LIKE 'pull_number'");
  if (!reportPullNumberCol.length) {
    await connection.query('ALTER TABLE admin_report_ledger ADD COLUMN pull_number INT NULL AFTER pull_id');
  }

  const [reportNoteCol] = await connection.query("SHOW COLUMNS FROM admin_report_ledger LIKE 'note'");
  if (!reportNoteCol.length) {
    await connection.query('ALTER TABLE admin_report_ledger ADD COLUMN note VARCHAR(255) NULL AFTER amount');
  }

  const [reportAdminIdx] = await connection.query("SHOW INDEX FROM admin_report_ledger WHERE Key_name = 'idx_report_admin_created'");
  if (!reportAdminIdx.length) {
    await connection.query('ALTER TABLE admin_report_ledger ADD INDEX idx_report_admin_created (admin_id, created_at)');
  }

  const [reportAdminUserIdx] = await connection.query("SHOW INDEX FROM admin_report_ledger WHERE Key_name = 'idx_report_admin_user_created'");
  if (!reportAdminUserIdx.length) {
    await connection.query('ALTER TABLE admin_report_ledger ADD INDEX idx_report_admin_user_created (admin_id, user_id, created_at)');
  }

  const [reportTypeIdx] = await connection.query("SHOW INDEX FROM admin_report_ledger WHERE Key_name = 'idx_report_type_created'");
  if (!reportTypeIdx.length) {
    await connection.query('ALTER TABLE admin_report_ledger ADD INDEX idx_report_type_created (entry_type, created_at)');
  }

  console.log('Database initialized successfully');
  console.log('Default admin ensured if no admins exist: username=admin, password=admin123');
  await connection.end();
}

initDb().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
