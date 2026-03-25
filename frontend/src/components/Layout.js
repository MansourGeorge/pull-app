import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiHome, FiUsers, FiSettings, FiGrid, FiList, FiLogOut, FiGlobe, FiMenu, FiLayers, FiUserPlus, FiStar, FiBarChart2 } from 'react-icons/fi';

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const { t, lang, toggleLang, isRTL } = useLang();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isAdminPanel = user?.role === 'admin' || user?.role === 'subadmin';
  const isMainAdmin = user?.role === 'admin';
  const roleLabel = user?.role === 'subadmin'
    ? (lang === 'ar' ? 'مشرف فرعي' : 'Subadmin')
    : isAdminPanel
      ? t('admin')
      : t('user');

  const adminNavItems = [
    { to: '/admin', label: t('dashboard'), Icon: FiHome, end: true },
    { to: '/admin/users', label: t('users'), Icon: FiUsers },
    ...(isMainAdmin
      ? [{ to: '/admin/subadmins', label: lang === 'ar' ? 'مشرفون فرعيون' : 'Subadmins', Icon: FiUserPlus }]
      : []),
    { to: '/admin/reports', label: t('reports'), Icon: FiBarChart2 },
    { to: '/admin/settings', label: t('settings'), Icon: FiSettings },
  ];

  const navItems = isAdminPanel ? adminNavItems : [
    { to: '/dashboard', label: t('pulls'), Icon: FiGrid },
    { to: '/history', label: t('history'), Icon: FiList },
    { to: '/loyalty', label: t('loyalty'), Icon: FiStar },
    { to: '/settings', label: t('settings'), Icon: FiSettings },
  ];

  return (
    <div className="layout">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon"><FiLayers /></div>
            <div>
              <h2>PullZone</h2>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {isAdminPanel ? t('adminPanel') : t('userPanel')}
              </div>
            </div>
          </div>
        </div>

        <nav className="nav-section">
          <div className="nav-section-title">{lang === 'en' ? 'Menu' : 'القائمة'}</div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon"><item.Icon /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{(user?.username || 'U')[0].toUpperCase()}</div>
            <div className="user-info-text">
              <div className="user-info-name">{user?.username}</div>
              <div className="user-info-role">{roleLabel}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-item" style={{ marginTop: '0.5rem', color: 'var(--danger)' }}>
            <span className="nav-icon"><FiLogOut /></span>
            {t('logout')}
          </button>
        </div>
      </aside>

      <div className="main-content">
        <div className="top-bar">
          <div className="top-bar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
              <FiMenu />
            </button>
            <span className="top-bar-title">{title}</span>
          </div>
          <div className="top-bar-right">
            <button className="lang-toggle" onClick={toggleLang} title="Switch Language">
              <span className="icon"><FiGlobe /></span>
              {lang === 'en' ? 'عربي' : 'English'}
            </button>
            <div className="user-avatar top-bar-avatar">
              {(user?.username || 'U')[0].toUpperCase()}
            </div>
            <span className="top-bar-username">{user?.username}</span>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

