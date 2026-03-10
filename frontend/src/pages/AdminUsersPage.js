import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { FiUsers, FiTarget, FiTrash2, FiX, FiCheck, FiSearch, FiEdit2 } from 'react-icons/fi';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAttemptsModal, setShowAttemptsModal] = useState(null);
  const [attemptsForm, setAttemptsForm] = useState({ pull_id: '', attempts: 1 });
  const [saving, setSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', full_name: '', phone_number: '', password: '', admin_password: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState('');
  const { t } = useLang();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([api.get('/users'), api.get('/pulls')]);
      setUsers(u.data);
      setPulls(p.data.filter(p => p.status === 'active'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleGiveAttempts = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/users/${showAttemptsModal.id}/attempts`, {
        pull_id: attemptsForm.pull_id,
        attempts: parseInt(attemptsForm.attempts)
      });
      toast.success(t('attemptsGranted'));
      setShowAttemptsModal(null);
    } catch (err) { toast.error(err.response?.data?.message || t('errorSave')); }
    finally { setSaving(false); }
  };

  const handleDeleteUser = async (id, username) => {
    if (!window.confirm(`${t('deleteUserConfirm')} "${username}"?`)) return;
    try { await api.delete(`/users/${id}`); toast.success(t('userDeleted')); fetchAll(); }
    catch { toast.error(t('errorDelete')); }
  };

  const openEditModal = (user) => {
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
    setSavingEdit(true);
    try {
      const payload = {
        username: editForm.username,
        full_name: editForm.full_name,
        phone_number: editForm.phone_number,
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
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openEditModal(user)}
                        >
                          <span className="icon"><FiEdit2 /></span>
                          {t('edit')}
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => { setShowAttemptsModal(user); setAttemptsForm({ pull_id: pulls[0]?.id || '', attempts: 1 }); }}
                        >
                          <span className="icon"><FiTarget /></span>
                          {t('giveAttempts')}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(user.id, user.username)} aria-label={t('deleteUser')}>
                          <FiTrash2 />
                        </button>
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
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAttemptsModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                <span className="icon"><FiTarget /></span>
                {t('giveAttempts')}
              </span>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowAttemptsModal(null)} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg2)', borderRadius: 8 }}>
              <div style={{ fontWeight: 700 }}>@{showAttemptsModal.username}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{showAttemptsModal.full_name}</div>
            </div>
            <form onSubmit={handleGiveAttempts}>
              <div className="form-group">
                <label>{t('pull')}</label>
                <select className="form-control" value={attemptsForm.pull_id} onChange={e => setAttemptsForm({...attemptsForm, pull_id: e.target.value})} required>
                  <option value="">{t('selectPull')}</option>
                  {pulls.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('attemptsCount')}</label>
                <input className="form-control" type="number" min="1" value={attemptsForm.attempts} onChange={e => setAttemptsForm({...attemptsForm, attempts: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAttemptsModal(null)}>{t('cancel')}</button>
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
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
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
