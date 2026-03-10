import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserDashboard from './pages/UserDashboard';
import PullPage from './pages/PullPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminPullManage from './pages/AdminPullManage';
import AdminUsersPage from './pages/AdminUsersPage';
import SettingsPage from './pages/SettingsPage';
import HistoryPage from './pages/HistoryPage';

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) {
    const fallback = user.role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={fallback} />;
  }
  return children;
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/admin/login" element={<Navigate to="/login" />} />
            <Route path="/admin" element={<PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>} />
            <Route path="/admin/pulls/:id" element={<PrivateRoute role="admin"><AdminPullManage /></PrivateRoute>} />
            <Route path="/admin/users" element={<PrivateRoute role="admin"><AdminUsersPage /></PrivateRoute>} />
            <Route path="/admin/settings" element={<PrivateRoute role="admin"><SettingsPage isAdmin /></PrivateRoute>} />
            <Route path="/dashboard" element={<PrivateRoute role="user"><UserDashboard /></PrivateRoute>} />
            <Route path="/pull/:id" element={<PrivateRoute role="user"><PullPage /></PrivateRoute>} />
            <Route path="/history" element={<PrivateRoute role="user"><HistoryPage /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute role="user"><SettingsPage /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
        <ToastContainer position="top-right" theme="dark" />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
