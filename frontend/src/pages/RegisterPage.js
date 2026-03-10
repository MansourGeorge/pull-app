import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiGlobe, FiUserPlus } from 'react-icons/fi';

export default function RegisterPage() {
  const DEFAULT_PHONE_PREFIX = '+961';
  const [form, setForm] = useState({ username: '', full_name: '', phone_number: DEFAULT_PHONE_PREFIX, password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === 'admin') navigate('/admin', { replace: true });
    if (user?.role === 'user') navigate('/dashboard', { replace: true });
  }, [user, authLoading, navigate]);

  const normalizePhone = (value) => {
    const trimmed = value.trim();
    if (trimmed === '') return DEFAULT_PHONE_PREFIX;
    if (trimmed.startsWith('+')) return trimmed;
    return `${DEFAULT_PHONE_PREFIX}${trimmed}`;
  };

  const handlePhoneChange = (e) => {
    setForm((prev) => ({ ...prev, phone_number: normalizePhone(e.target.value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error(t('passwordMismatch')); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/user/register', {
        username: form.username, full_name: form.full_name,
        phone_number: normalizePhone(form.phone_number), password: form.password
      });
      const { token, ...userData } = res.data;
      login(token, userData);
      toast.success(t('registerSuccess'));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('registerError'));
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
          <div className="logo-icon"><FiUserPlus /></div>
          <h1>{t('createAccount')}</h1>
          <p>{t('joinNow')}</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('fullName')}</label>
            <input className="form-control" placeholder={lang === 'en' ? 'John Smith' : ''}
              value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>{t('username')}</label>
            <input className="form-control" placeholder="username123"
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>{t('phoneNumber')}</label>
            <input className="form-control" placeholder="+961"
              value={form.phone_number} onChange={handlePhoneChange} required />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input className="form-control" type="password" placeholder={t('strongPassword')}
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>{t('confirmPassword')}</label>
            <input className="form-control" type="password" placeholder={t('reenterPassword')}
              value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? t('loading') : (
              <>
                <span className="icon"><FiUserPlus /></span>
                {t('createAccount')}
              </>
            )}
          </button>
        </form>
        <div className="divider" />
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {t('haveAccount')}{' '}
          <Link to="/login" style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{t('login')}</Link>
        </p>
      </div>
    </div>
  );
}
