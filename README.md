# 🎰 PullZone - منصة البولات الإلكترونية

Full-stack web application for managing pull/raffle events built with Node.js, React, and MySQL.

## 🌟 Features

### Admin
- Secure admin login (pre-seeded in DB)
- Create, edit, delete pulls with photo upload
- Each pull auto-assigns 100 random Arabic names to numbers 00-99
- Set max choices per pull (0 = show contact phone)
- Manage users and grant attempts
- **Live Draw**: Start a live broadcast so all users watch in real-time, then announce winner
- View all participants per pull

### User
- Register & Login with unique username
- Browse all pulls with photos and status
- Select numbers from 00-99 (blocked if already taken)
- Real-time updates via Socket.IO
- Winner celebration animation with confetti
- Pull history with winning status
- Change password in settings

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React 18, React Router v6, Socket.IO Client
- **Database**: MySQL 8+
- **Auth**: JWT + bcryptjs
- **File Upload**: express-fileupload

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- MySQL 8+
- npm

### Step 1: Database Setup
```bash
# Login to MySQL and create DB + seed data:
mysql -u root -p < backend/config/schema.sql
```

### Step 2: Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your MySQL credentials
```

### Step 3: Install Dependencies
```bash
npm run install-all
```

### Step 4: Start Development
```bash
npm run dev
```

- Backend: http://localhost:5000
- Frontend: http://localhost:3000

### Step 5: Production Build
```bash
npm run build
# Then serve frontend/build with nginx or express static
```

## 🔐 Default Admin Credentials
- **Username**: `admin`
- **Password**: `admin123`

> ⚠️ Change the admin password after first login!

## 📁 Project Structure
```
pull-app/
├── backend/
│   ├── config/
│   │   ├── db.js          # MySQL connection pool
│   │   ├── schema.sql     # DB schema + 200 Arabic names
│   │   └── initDb.js      # DB init script
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   ├── routes/
│   │   ├── auth.js        # Login/register
│   │   ├── pulls.js       # Pull CRUD + reserve + winner
│   │   └── users.js       # User management
│   ├── uploads/           # Uploaded photos
│   ├── server.js          # Express + Socket.IO server
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       │   └── Layout.js  # Sidebar layout
│       ├── context/
│       │   └── AuthContext.js
│       ├── pages/
│       │   ├── LoginPage.js
│       │   ├── RegisterPage.js
│       │   ├── AdminLoginPage.js
│       │   ├── AdminDashboard.js
│       │   ├── AdminPullManage.js  # Live draw here
│       │   ├── AdminUsersPage.js
│       │   ├── UserDashboard.js
│       │   ├── PullPage.js         # Number picker
│       │   ├── HistoryPage.js
│       │   └── SettingsPage.js
│       └── utils/
│           └── api.js     # Axios instance
└── package.json           # Root scripts
```

## 🎲 How the Live Draw Works
1. Admin goes to Pull Management page
2. Clicks "بدء البث المباشر للسحب" (Start Live Draw)
3. All connected users see a LIVE indicator on their pull page
4. Admin selects winning number and clicks "إعلان الفائز" (Announce Winner)
5. All users see winner celebration animation with confetti simultaneously
6. If the logged-in user is the winner, special congratulation message appears

## 🚢 Deployment Notes

### Using PM2 + Nginx
```bash
# Build frontend
npm run build

# Start backend with PM2
pm2 start backend/server.js --name pullzone

# Nginx config: serve frontend/build as static, proxy /api and /socket.io to :5000
```

### Environment Variables (backend/.env)
| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 5000) |
| DB_HOST | MySQL host |
| DB_USER | MySQL username |
| DB_PASSWORD | MySQL password |
| DB_NAME | Database name |
| JWT_SECRET | Secret key for JWT tokens |
| ADMIN_PHONE | Default admin contact phone |
