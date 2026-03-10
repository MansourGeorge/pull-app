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
  console.log('✅ Database initialized successfully');
  console.log('✅ Default admin ensured if no admins exist: username=admin, password=admin123');
  await connection.end();
}

initDb().catch(err => {
  console.error('❌ Database initialization failed:', err);
  process.exit(1);
});
