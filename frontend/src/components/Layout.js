import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiHome, FiUsers, FiSettings, FiGrid, FiList, FiLogOut, FiGlobe, FiMenu, FiLayers } from 'react-icons/fi';

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const { t, lang, toggleLang, isRTL } = useLang();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isAdmin = user?.role === 'admin';

  const navItems = isAdmin ? [
    { to: '/admin', label: t('dashboard'), Icon: FiHome, end: true },
    { to: '/admin/users', label: t('users'), Icon: FiUsers },
    { to: '/admin/settings', label: t('settings'), Icon: FiSettings },
  ] : [
    { to: '/dashboard', label: t('pulls'), Icon: FiGrid },
    { to: '/history', label: t('history'), Icon: FiList },
    { to: '/settings', label: t('settings'), Icon: FiSettings },
  ];

  return (
    <div className="layout">
      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon"><FiLayers /></div>
            <div>
              <h2>PullZone</h2>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {isAdmin ? t('adminPanel') : t('userPanel')}
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
              <div className="user-info-role">{isAdmin ? t('admin') : t('user')}</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
              <FiMenu />
            </button>
            <span className="top-bar-title">{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="lang-toggle" onClick={toggleLang} title="Switch Language">
              <span className="icon"><FiGlobe /></span>
              {lang === 'en' ? 'عربي' : 'English'}
            </button>
            <div className="user-avatar" style={{ width: 36, height: 36, fontSize: '0.9rem' }}>
              {(user?.username || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user?.username}</span>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
