import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiGlobe, FiLayers, FiLogIn, FiUser, FiShield } from 'react-icons/fi';

const isAdminRole = (role) => role === 'admin' || role === 'subadmin';

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const navigate = useNavigate();
  const [role, setRole] = useState('user');

  useEffect(() => {
    if (authLoading) return;
    if (isAdminRole(user?.role)) navigate('/admin', { replace: true });
    if (user?.role === 'user') navigate('/dashboard', { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = role === 'admin' ? '/auth/admin/login' : '/auth/user/login';
      const res = await api.post(endpoint, form);
      const { token, ...userData } = res.data;
      login(token, userData);
      navigate(isAdminRole(userData.role) ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('loginError'));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="lang-toggle" onClick={toggleLang}>
            <span className="icon"><FiGlobe /></span>
            {lang === 'en' ? 'عربي' : 'English'}
          </button>
        </div>
        <div className="auth-logo">
          <div className="logo-icon"><FiLayers /></div>
          <h1>PullZone</h1>
          <p>{lang === 'en' ? 'Login to participate in pulls' : 'سجّل دخولك للمشاركة في البولات'}</p>
        </div>
        <div className="role-toggle">
          <span className="role-toggle-label">{t('loginAs')}</span>
          <div className="role-toggle-group">
            <button
              type="button"
              className={`role-option ${role === 'user' ? 'active' : ''}`}
              onClick={() => setRole('user')}
            >
              <span className="icon"><FiUser /></span>
              {t('user')}
            </button>
            <button
              type="button"
              className={`role-option ${role === 'admin' ? 'active' : ''}`}
              onClick={() => setRole('admin')}
            >
              <span className="icon"><FiShield /></span>
              {t('admin')}
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('username')}</label>
            <input className="form-control" placeholder={t('enterUsername')}
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input className="form-control" type="password" placeholder={t('enterPassword')}
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? t('loading') : (
              <>
                <span className="icon"><FiLogIn /></span>
                {t('login')}
              </>
            )}
          </button>
        </form>
        {role === 'user' && (
          <>
            <div className="divider" />
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {t('noAccount')}{' '}
              <Link to="/register" style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{t('register')}</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
