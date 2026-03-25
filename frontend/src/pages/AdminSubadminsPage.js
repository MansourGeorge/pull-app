import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { FiUserPlus, FiUsers, FiEdit2, FiTrash2, FiX, FiCheck, FiSearch } from 'react-icons/fi';
import { LEBANON_PHONE_PATTERN, isValidLebanesePhone, normalizeLebanesePhone } from '../utils/phone';

export default function AdminSubadminsPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subadmins, setSubadmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', full_name: '', password: '', phone_number: '' });
  const [creating, setCreating] = useState(false);

  const [showEditModal, setShowEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', full_name: '', password: '', phone_number: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const isMainAdmin = user?.role === 'admin';

  useEffect(() => {
    if (user && !isMainAdmin) {
      toast.error('This page is available to main admin only');
      navigate('/admin', { replace: true });
    }
  }, [user, isMainAdmin, navigate]);

  const fetchSubadmins = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/admin/subadmins');
      setSubadmins(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMainAdmin) fetchSubadmins();
  }, [isMainAdmin]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (
      !createForm.username.trim() ||
      !createForm.full_name.trim() ||
      !createForm.phone_number.trim() ||
      !createForm.password.trim()
    ) {
      toast.error(t('fieldsRequired'));
      return;
    }
    if (createForm.password.trim().length < 6) {
      toast.error(t('passwordTooShort'));
      return;
    }
    const normalizedPhone = normalizeLebanesePhone(createForm.phone_number);
    if (!isValidLebanesePhone(normalizedPhone)) {
      toast.error(t('phoneFormatInvalid'));
      return;
    }

    setCreating(true);
    try {
      const payload = {
        username: createForm.username.trim(),
        full_name: createForm.full_name.trim(),
        phone_number: normalizedPhone,
        password: createForm.password.trim()
      };
      const res = await api.post('/auth/admin/subadmins', payload);
      toast.success(res.data?.message || 'Subadmin created successfully');
      setCreateForm({ username: '', full_name: '', password: '', phone_number: '' });
      setShowCreateModal(false);
      fetchSubadmins();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorCreate'));
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (subadmin) => {
    setShowEditModal(subadmin);
    setEditForm({
      username: subadmin.username || '',
      full_name: subadmin.full_name || '',
      phone_number: subadmin.phone_number || '',
      password: ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!showEditModal) return;

    if (!editForm.username.trim() || !editForm.full_name.trim() || !editForm.phone_number.trim()) {
      toast.error(t('fieldsRequired'));
      return;
    }
    if (editForm.password && editForm.password.trim() && editForm.password.trim().length < 6) {
      toast.error(t('passwordTooShort'));
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
        username: editForm.username.trim(),
        full_name: editForm.full_name.trim(),
        phone_number: normalizedPhone
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await api.put(`/auth/admin/subadmins/${showEditModal.id}`, payload);
      toast.success(res.data?.message || 'Subadmin updated successfully');
      setShowEditModal(null);
      fetchSubadmins();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorSave'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (subadmin) => {
    if (!window.confirm(`Delete subadmin "${subadmin.username}"?`)) return;
    try {
      const res = await api.delete(`/auth/admin/subadmins/${subadmin.id}`);
      toast.success(res.data?.message || 'Subadmin deleted successfully');
      fetchSubadmins();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorDelete'));
    }
  };

  const filtered = subadmins.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.username?.toLowerCase().includes(q) ||
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.phone_number || '').toLowerCase().includes(q)
    );
  });

  const countLabel = search.trim() ? `${filtered.length}/${subadmins.length}` : subadmins.length;

  return (
    <Layout title={lang === 'ar' ? 'المشرفون الفرعيون' : 'Subadmins'}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="icon"><FiUsers /></span>
            {lang === 'ar' ? `المشرفون الفرعيون (${countLabel})` : `Subadmins (${countLabel})`}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="search-bar">
              <span className="icon"><FiSearch /></span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('search')}
                aria-label={t('search')}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              <span className="icon"><FiUserPlus /></span>
              {lang === 'ar' ? 'إضافة مشرف فرعي' : 'Add Subadmin'}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiUsers /></div>
            <div className="empty-state-title">{lang === 'ar' ? 'لا يوجد مشرفون فرعيون' : 'No subadmins yet'}</div>
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
                {filtered.map((subadmin) => (
                  <tr key={subadmin.id}>
                    <td data-label={t('username')} style={{ fontWeight: 700 }}>@{subadmin.username}</td>
                    <td data-label={t('fullName')}>{subadmin.full_name || '-'}</td>
                    <td data-label={t('phoneNumber')}>{subadmin.phone_number || '-'}</td>
                    <td data-label={t('joinDate')} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {subadmin.created_at ? new Date(subadmin.created_at).toLocaleDateString() : '-'}
                    </td>
                    <td data-label={t('actions')}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(subadmin)}>
                          <span className="icon"><FiEdit2 /></span>
                          {t('edit')}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(subadmin)} aria-label={t('delete')}>
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

      {showCreateModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <span className="modal-title">
                <span className="icon"><FiUserPlus /></span>
                {lang === 'ar' ? 'إضافة مشرف فرعي' : 'Add Subadmin'}
              </span>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowCreateModal(false)} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>{t('username')}</label>
                <input
                  className="form-control"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('fullName')}</label>
                <input
                  className="form-control"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('password')}</label>
                <input
                  className="form-control"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder={lang === 'ar' ? 'على الأقل 6 أحرف' : 'At least 6 characters'}
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('phoneNumber')}</label>
                <input
                  className="form-control"
                  value={createForm.phone_number}
                  onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })}
                  placeholder="+961..."
                  type="tel"
                  inputMode="tel"
                  pattern={LEBANON_PHONE_PATTERN}
                  title={t('phoneFormatHint')}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? t('loading') : (
                    <>
                      <span className="icon"><FiCheck /></span>
                      {lang === 'ar' ? 'إنشاء الحساب' : 'Create Account'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <span className="modal-title">
                <span className="icon"><FiEdit2 /></span>
                {lang === 'ar' ? 'تعديل مشرف فرعي' : 'Edit Subadmin'}
              </span>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowEditModal(null)} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>{t('username')}</label>
                <input
                  className="form-control"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('fullName')}</label>
                <input
                  className="form-control"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('phoneNumber')}</label>
                <input
                  className="form-control"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  placeholder="+961..."
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
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder={lang === 'ar' ? 'اتركه فارغاً للإبقاء على كلمة المرور الحالية' : 'Leave empty to keep current password'}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(null)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
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
