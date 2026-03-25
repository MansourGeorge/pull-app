import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { FiUsers, FiTarget, FiTrash2, FiX, FiCheck, FiSearch, FiEdit2 } from 'react-icons/fi';
import { LEBANON_PHONE_PATTERN, isValidLebanesePhone, normalizeLebanesePhone } from '../utils/phone';

export default function AdminUsersPage() {
  const emptyAttemptsInfo = { currentBalance: 0 };
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAttemptsModal, setShowAttemptsModal] = useState(null);
  const [attemptsForm, setAttemptsForm] = useState({ amount: '', action: 'add' });
  const [attemptsInfo, setAttemptsInfo] = useState(emptyAttemptsInfo);
  const [loadingAttemptsInfo, setLoadingAttemptsInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', full_name: '', phone_number: '', password: '', admin_password: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState('');
  const { t, lang } = useLang();
  const { user } = useAuth();
  const canEditOrDeleteUsers = user?.role === 'admin';

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  const closeAttemptsModal = () => {
    setShowAttemptsModal(null);
    setAttemptsForm({ amount: '', action: 'add' });
    setAttemptsInfo(emptyAttemptsInfo);
    setLoadingAttemptsInfo(false);
  };

  const openAttemptsModal = (selectedUser) => {
    setShowAttemptsModal(selectedUser);
    setAttemptsForm({ amount: '', action: 'add' });
    setAttemptsInfo(emptyAttemptsInfo);
  };

  useEffect(() => {
    const userId = showAttemptsModal?.id;

    if (!userId) {
      setAttemptsInfo(emptyAttemptsInfo);
      setLoadingAttemptsInfo(false);
      return;
    }

    let cancelled = false;
    const fetchAttemptsInfo = async () => {
      setLoadingAttemptsInfo(true);
      try {
        const res = await api.get(`/users/${userId}/attempts`);
        if (!cancelled) {
          setAttemptsInfo({
            currentBalance: Number(res.data?.currentBalance || 0),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setAttemptsInfo(emptyAttemptsInfo);
          toast.error(err.response?.data?.message || t('errorGeneric'));
        }
      } finally {
        if (!cancelled) setLoadingAttemptsInfo(false);
      }
    };

    fetchAttemptsInfo();
    return () => { cancelled = true; };
  }, [showAttemptsModal?.id, t]);

  const handleGiveAttempts = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/users/${showAttemptsModal.id}/attempts`, {
        amount: Number.parseFloat(attemptsForm.amount),
        action: attemptsForm.action
      });
      toast.success(t('fundsUpdated'));
      closeAttemptsModal();
    } catch (err) { toast.error(err.response?.data?.message || t('errorSave')); }
    finally { setSaving(false); }
  };

  const handleDeleteUser = async (id, username) => {
    if (!canEditOrDeleteUsers) {
      toast.error(lang === 'ar' ? 'لا تملك صلاحية تعديل أو حذف المستخدمين' : 'You cannot edit or delete users');
      return;
    }
    if (!window.confirm(`${t('deleteUserConfirm')} "${username}"?`)) return;
    try { await api.delete(`/users/${id}`); toast.success(t('userDeleted')); fetchAll(); }
    catch { toast.error(t('errorDelete')); }
  };

  const openEditModal = (user) => {
    if (!canEditOrDeleteUsers) {
      toast.error(lang === 'ar' ? 'لا تملك صلاحية تعديل أو حذف المستخدمين' : 'You cannot edit or delete users');
      return;
    }
    setShowEditModal(user);
    setEditForm({
      username: user.username || '',
      full_name: user.full_name || '',
      phone_number: user.phone_number || '',
      password: '',
      admin_password: ''
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editForm.admin_password || !editForm.admin_password.trim()) {
      toast.error(t('adminPasswordRequired'));
      return;
    }
    const normalizedPhone = normalizeLebanesePhone(editForm.phone_number);
    if (!isValidLebanesePhone(normalizedPhone)) {
      toast.error(t('phoneFormatInvalid'));
      return;
    }
    setSavingEdit(true);
    try {
      const payload = {
        username: editForm.username,
        full_name: editForm.full_name,
        phone_number: normalizedPhone,
        admin_password: editForm.admin_password
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password;
      }
      await api.put(`/users/${showEditModal.id}`, payload);
      toast.success(t('userUpdated'));
      setShowEditModal(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorSave'));
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.username?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.phone_number?.toLowerCase().includes(q)
    );
  });
  const countLabel = search.trim() ? `${filteredUsers.length}/${users.length}` : users.length;

  return (
    <Layout title={t('users')}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="icon"><FiUsers /></span>
            {t('users')} ({countLabel})
          </span>
          <div className="search-bar">
            <span className="icon"><FiSearch /></span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
            />
          </div>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiUsers /></div>
            <div className="empty-state-title">{t('noUsers')}</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiSearch /></div>
            <div className="empty-state-title">{t('noResults')}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('username')}</th>
                  <th>{t('fullName')}</th>
                  <th>{t('phoneNumber')}</th>
                  <th>{t('joinDate')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td data-label={t('username')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="user-avatar" style={{ width: 36, height: 36, fontSize: '0.9rem' }}>
                          {user.username[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>@{user.username}</span>
                      </div>
                    </td>
                    <td data-label={t('fullName')}>{user.full_name}</td>
                    <td data-label={t('phoneNumber')} style={{ direction: 'ltr', fontFamily: 'monospace' }}>{user.phone_number}</td>
                    <td data-label={t('joinDate')} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td data-label={t('actions')}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {canEditOrDeleteUsers && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEditModal(user)}
                          >
                            <span className="icon"><FiEdit2 /></span>
                            {t('edit')}
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openAttemptsModal(user)}
                        >
                          <span className="icon"><FiTarget /></span>
                          {t('manageFunds')}
                        </button>
                        {canEditOrDeleteUsers && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(user.id, user.username)} aria-label={t('deleteUser')}>
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAttemptsModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeAttemptsModal()}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                <span className="icon"><FiTarget /></span>
                {t('manageFunds')}
              </span>
              <button className="btn btn-icon btn-secondary" onClick={closeAttemptsModal} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg2)', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>@{showAttemptsModal.username}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{showAttemptsModal.full_name}</div>
            </div>
            <form onSubmit={handleGiveAttempts}>
              <div style={{ marginBottom: '1rem', padding: '0.9rem', background: 'var(--bg2)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                {loadingAttemptsInfo ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('loading')}</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.65rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{t('currentBalance')}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{attemptsInfo.currentBalance.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>{t('transactionType')}</label>
                <select
                  className="form-control"
                  value={attemptsForm.action}
                  onChange={e => setAttemptsForm({ ...attemptsForm, action: e.target.value })}
                >
                  <option value="add">{t('addFunds')}</option>
                  <option value="remove">{t('cashback')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('amount')}</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={attemptsForm.amount}
                  onChange={e => setAttemptsForm({ ...attemptsForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeAttemptsModal}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('loading') : (
                    <>
                      <span className="icon"><FiCheck /></span>
                      {t('confirm')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEditModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                <span className="icon"><FiEdit2 /></span>
                {t('editUser')}
              </span>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowEditModal(null)} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg2)', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>@{showEditModal.username}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{showEditModal.full_name}</div>
            </div>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label>{t('username')}</label>
                <input
                  className="form-control"
                  value={editForm.username}
                  onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('fullName')}</label>
                <input
                  className="form-control"
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('phoneNumber')}</label>
                <input
                  className="form-control"
                  value={editForm.phone_number}
                  onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                  type="tel"
                  inputMode="tel"
                  pattern={LEBANON_PHONE_PATTERN}
                  title={t('phoneFormatHint')}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('newPasswordOptional')}</label>
                <input
                  className="form-control"
                  type="password"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder={t('newPassword')}
                />
              </div>
              <div className="form-group">
                <label>{t('adminPassword')}</label>
                <input
                  className="form-control"
                  type="password"
                  value={editForm.admin_password}
                  onChange={e => setEditForm({ ...editForm, admin_password: e.target.value })}
                  placeholder={t('enterAdminPassword')}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(null)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit || !editForm.admin_password.trim()}>
                  {savingEdit ? t('loading') : (
                    <>
                      <span className="icon"><FiCheck /></span>
                      {t('save')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
