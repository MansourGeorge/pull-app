import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiShield, FiUser, FiCheck, FiSave, FiUserCheck } from 'react-icons/fi';
import { LEBANON_PHONE_PATTERN, isValidLebanesePhone, normalizeLebanesePhone } from '../utils/phone';

export default function SettingsPage({ isAdmin }) {
  const { user, updateUser } = useAuth();
  const { t, lang } = useLang();
  const isSubadmin = user?.role === 'subadmin';
  const roleLabel = isSubadmin ? (lang === 'ar' ? 'مشرف فرعي' : 'Subadmin') : (isAdmin ? t('admin') : t('user'));
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({ username: '', full_name: '', phone_number: '', loyalty_percentage: 0 });
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await api.get(isAdmin ? '/auth/admin/profile' : '/auth/user/profile');
      setProfile({
        username: res.data.username || '',
        full_name: res.data.full_name || '',
        phone_number: res.data.phone_number || '',
        loyalty_percentage: Number(res.data.loyalty_percentage || 0)
      });
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (user?.username || user?.full_name || user?.phone_number) {
      setProfile({
        username: user?.username || '',
        full_name: user?.full_name || '',
        phone_number: user?.phone_number || '',
        loyalty_percentage: Number(user?.loyalty_percentage || 0)
      });
    }
    loadProfile();
  }, [isAdmin, user?.username, user?.full_name, user?.phone_number, user?.loyalty_percentage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { toast.error(t('passwordMismatch')); return; }
    if (form.newPassword.length < 6) { toast.error(t('passwordTooShort')); return; }
    setLoading(true);
    try {
      const endpoint = isAdmin ? '/auth/admin/change-password' : '/auth/user/change-password';
      await api.put(endpoint, { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success(t('passwordChanged'));
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || t('wrongPassword'));
    } finally { setLoading(false); }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (
      !profile.username.trim() ||
      !profile.full_name.trim() ||
      !profile.phone_number.trim()
    ) {
      toast.error(t('fieldsRequired'));
      return;
    }
    setSavingProfile(true);
    try {
      const normalizedPhone = normalizeLebanesePhone(profile.phone_number);
      if (!isValidLebanesePhone(normalizedPhone)) {
        toast.error(t('phoneFormatInvalid'));
        setSavingProfile(false);
        return;
      }
      const parsedLoyaltyPercentage = Number.parseFloat(profile.loyalty_percentage === '' ? '0' : profile.loyalty_percentage);
      if (isAdmin && (!Number.isFinite(parsedLoyaltyPercentage) || parsedLoyaltyPercentage < 0 || parsedLoyaltyPercentage > 100)) {
        toast.error(t('loyaltyPercentageRange'));
        setSavingProfile(false);
        return;
      }

      const payload = isAdmin
        ? {
            username: profile.username.trim(),
            full_name: profile.full_name.trim(),
            phone_number: normalizedPhone,
            loyalty_percentage: Number(parsedLoyaltyPercentage.toFixed(2))
          }
        : { username: profile.username.trim(), full_name: profile.full_name.trim(), phone_number: normalizedPhone };
      const res = await api.put(isAdmin ? '/auth/admin/profile' : '/auth/user/profile', payload);
      updateUser(res.data);
      setProfile({
        username: res.data.username || '',
        full_name: res.data.full_name || '',
        phone_number: normalizedPhone,
        loyalty_percentage: Number(res.data.loyalty_percentage || 0)
      });
      toast.success(t('profileUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorSave'));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <Layout title={t('settings')}>
      <div className="settings-container">
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="user-avatar" style={{ width: 72, height: 72, fontSize: '2rem', borderRadius: 18 }}>
              {(user?.username || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{user?.username}</div>
              <div style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="icon">{isAdmin ? <FiShield /> : <FiUser />}</span>
                {roleLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">
              <span className="icon"><FiUserCheck /></span>
              {t('profile')}
            </span>
          </div>
          {profileLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
          ) : (
            <form onSubmit={handleProfileSave}>
              <div className="form-group">
                <label>{t('username')}</label>
                <input
                  className="form-control"
                  value={profile.username}
                  onChange={e => setProfile({ ...profile, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('fullName')}</label>
                <input
                  className="form-control"
                  value={profile.full_name}
                  onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('phoneNumber')}</label>
                <input
                  className="form-control"
                  value={profile.phone_number}
                  onChange={e => setProfile({ ...profile, phone_number: e.target.value })}
                  type="tel"
                  inputMode="tel"
                  pattern={LEBANON_PHONE_PATTERN}
                  title={t('phoneFormatHint')}
                  required
                />
              </div>
              {isAdmin && (
                <div className="form-group">
                  <label>{t('loyaltyPercentage')}</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={profile.loyalty_percentage}
                    onChange={e => setProfile({ ...profile, loyalty_percentage: e.target.value })}
                    placeholder={t('loyaltyPercentagePlaceholder')}
                  />
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-full" disabled={savingProfile}>
                {savingProfile ? t('loading') : (
                  <>
                    <span className="icon"><FiSave /></span>
                    {t('save')}
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">{t('changePassword')}</span></div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{t('currentPassword')}</label>
              <input className="form-control" type="password" placeholder="••••••••"
                value={form.currentPassword} onChange={e => setForm({...form, currentPassword: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>{t('newPassword')}</label>
              <input className="form-control" type="password" placeholder="Min. 6 characters"
                value={form.newPassword} onChange={e => setForm({...form, newPassword: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>{t('confirmPassword')}</label>
              <input className="form-control" type="password" placeholder="Repeat new password"
                value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} required />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? t('updating') : (
                <>
                  <span className="icon"><FiCheck /></span>
                  {t('updatePassword')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
