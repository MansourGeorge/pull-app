CREATE DATABASE IFmysql -u root -p < backend/config/schema.sql NOT EXISTS pull_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pull_db;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE admins ADD COLUMN phone_number VARCHAR(20);

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
INSERT INTO admins (username, password)
SELECT 'admin', '$2a$10$WbhUchCTEVZ6sb8zXUZAe.JP9di2B7vFNF5S6Ot/s18s6WFTNWPWm'
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pull_id) REFERENCES pulls(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_pull (user_id, pull_id)
);
