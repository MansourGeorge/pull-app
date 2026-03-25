CREATE DATABASE IF NOT EXISTS pull_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pull_db;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','subadmin') NOT NULL DEFAULT 'admin',
  phone_number VARCHAR(20),
  loyalty_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arabic_names (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS pulls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  photo_url VARCHAR(500),
  status ENUM('active','closed','completed') DEFAULT 'active',
  winner_number INT,
  admin_phone VARCHAR(20),
  attempt_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_by_admin_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pulls_creator (created_by_admin_id),
  FOREIGN KEY (created_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pull_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pull_id INT NOT NULL,
  number INT NOT NULL,
  arabic_name VARCHAR(100) NOT NULL,
  user_id INT,
  reserved_at TIMESTAMP,
  FOREIGN KEY (pull_id) REFERENCES pulls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_pull_number (pull_id, number)
);

CREATE TABLE IF NOT EXISTS pull_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pull_id INT NOT NULL,
  winner_user_id INT,
  winner_number INT,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pull_id) REFERENCES pulls(id),
  FOREIGN KEY (winner_user_id) REFERENCES users(id)
);

-- Insert default admin only if admins table is empty (password: admin123)
INSERT INTO admins (username, password, role)
SELECT 'admin', '$2a$10$WbhUchCTEVZ6sb8zXUZAe.JP9di2B7vFNF5S6Ot/s18s6WFTNWPWm', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM admins LIMIT 1);

INSERT INTO arabic_names (name) VALUES
('جورج'),('جورجس'),('جوزيف'),('طوني'),('أنطوان'),('بيار'),('ميشال'),('إيلي'),('نديم'),('رامي'),
('كريم'),('وسام'),('زياد'),('نبيل'),('سامي'),('مازن'),('نادر'),('هادي'),('سليم'),('رائد'),
('باسل'),('وليد'),('أنور'),('حاتم'),('مروان'),('بشير'),('سمير'),('منير'),('شادي'),('عامر'),
('عادل'),('روبير'),('رياض'),('غسان'),('سركيس'),('حبيب'),('روني'),('ماهر'),('أيمن'),('إياد'),
('حازم'),('وائل'),('رامز'),('جلال'),('جمال'),('رستم'),('سهيل'),('جبران'),('رفيق'),('كمال'),
('نجيب'),('فارس'),('مارون'),('باسم'),('بديع'),('حكيم'),('ريان'),('قيس'),('قصي'),('يزن'),
('سيف'),('لؤي'),('مالك'),('مجدي'),('معتز'),('منصف'),('نزار'),('هشام'),('عدنان'),('عماد'),
('صبحي'),('ظافر'),('بدر'),('تميم'),('ثائر'),('جاسر'),('راغب'),('ضياء'),('عصام'),('عمران'),
('فهمي'),('كامل'),('لبيد'),('مفيد'),('نايف'),('هاني'),('كارلوس'),('فادي'),('جاد'),('طلال'),
('ليلى'),('رنا'),('ريما'),('رولا'),('لارا'),('لين'),('هبة'),('نوال'),('منى'),('سارة'),
('رولا'),('ريم'),('كارين'),('مايا'),('ميرنا'),('ميريام'),('كريستينا'),('باتريسيا'),('جيسيكا'),('ناتالي'),
('كلودين'),('جوليا'),('دانييلا'),('بيتي'),('إلسي'),('سلمى'),('أمل'),('سحر'),('روان'),('تاليا'),
('فرح'),('سالي'),('سوزان'),('رجاء'),('سندرا'),('ياسمين'),('لمى'),('جنى'),('تيا'),('ديما'),
('نادين'),('نرمين'),('كارلا'),('لاريسا'),('جوانا'),('شيرين'),('نهى'),('رغد'),('بيان'),('غادة'),
('ربى'),('أريج'),('رند'),('تولين'),('هلا'),('هناء'),('جيسي'),('روز'),('ليندا'),('فيوليت'),
('نانسي'),('سيرين'),('كايلا'),('تالين'),('ليان'),('لارين'),('ساندي'),('كاتيا'),('ماريا'),('ريتال'),
('ألكس'),('جوني'),('روي'),('جيمي'),('داني'),('كريس'),('نيكولا'),('طلال'),('سيرج'),('بسام'),
('جواد'),('كنان'),('ريان'),('آلان'),('غابي'),('إدوار'),('رالف'),('سامر'),('سهام'),('رودينا'),
('جيهان'),('بريجيت'),('هيلين'),('كاثرين'),('مارلين'),('رنايا'),('لارا'),('كندا'),('ليلاس'),('راما');
CREATE TABLE IF NOT EXISTS user_pull_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  pull_id INT NOT NULL,
  attempts INT DEFAULT 0,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pull_id) REFERENCES pulls(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_pull (user_id, pull_id)
);

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
);

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
);

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
);

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
);
