import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiGlobe, FiShield, FiInfo, FiLogIn, FiArrowLeft, FiArrowRight } from 'react-icons/fi';

export default function AdminLoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t, lang, toggleLang, isRTL } = useLang();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/login', form);
      login(res.data.token, { ...res.data });
      navigate('/admin');
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
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #FF6584, #c0392b)' }}>
            <FiShield />
          </div>
          <h1>{t('adminLogin')}</h1>
          <p>{t('adminLoginDesc')}</p>
        </div>
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <span className="icon"><FiInfo /></span>
          <span>{t('adminOnly')}</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('username')}</label>
            <input className="form-control" placeholder=""
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input className="form-control" type="password" placeholder="••••••••"
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
        <div className="divider" />
        <p style={{ textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="icon">{isRTL ? <FiArrowRight /> : <FiArrowLeft />}</span>
            {t('userLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
