import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { FiGrid, FiCheckCircle, FiAward, FiLock, FiEdit2, FiTrash2, FiPlus, FiX, FiCheck, FiSearch } from 'react-icons/fi';

export default function AdminDashboard() {
  const [pulls, setPulls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', admin_phone: '' });
  const [photo, setPhoto] = useState(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const { t } = useLang();
  const { user } = useAuth();

  const fetchPulls = async () => {
    setLoading(true);
    try {
      const res = await api.get('/pulls');
      setPulls(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchPulls(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => fd.append(k, form[k]));
      if (photo) fd.append('photo', photo);
      await api.post('/pulls', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(t('pullCreated'));
      setShowCreateModal(false);
      setForm({ title: '', description: '', admin_phone: '' });
      setPhoto(null);
      fetchPulls();
    } catch (err) { toast.error(err.response?.data?.message || t('errorCreate')); }
    finally { setCreating(false); }
  };

  const openCreateModal = () => {
    setForm({ title: '', description: '', admin_phone: user?.phone_number || '' });
    setPhoto(null);
    setShowCreateModal(true);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { await api.delete(`/pulls/${id}`); toast.success(t('pullDeleted')); fetchPulls(); }
    catch { toast.error(t('errorDelete')); }
  };

  const statusLabel = (s) => s === 'active' ? t('statusActive') : s === 'completed' ? t('statusCompleted') : t('statusClosed');
  const filteredPulls = pulls.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  });

  return (
    <Layout title={t('adminDashboard')}>
      <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
        {[
          { Icon: FiGrid, val: pulls.length, label: t('totalPulls'), cls: 'purple' },
          { Icon: FiCheckCircle, val: pulls.filter(p => p.status === 'active').length, label: t('activePulls'), cls: 'green' },
          { Icon: FiAward, val: pulls.filter(p => p.status === 'completed').length, label: t('completedPulls'), cls: 'gold' },
          { Icon: FiLock, val: pulls.filter(p => p.status === 'closed').length, label: t('closedPulls'), cls: 'red' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${s.cls}`}><s.Icon /></div>
            <div><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="icon"><FiGrid /></span>
            {t('pulls')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <span className="icon"><FiPlus /></span>
            {t('addPull')}
          </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : pulls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiGrid /></div>
            <div className="empty-state-title">{t('noPulls')}</div>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={openCreateModal}>
              <span className="icon"><FiPlus /></span>
              {t('addPull')}
            </button>
          </div>
        ) : filteredPulls.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiSearch /></div>
            <div className="empty-state-title">{t('noResults')}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('pullTitle')}</th><th>{t('status')}</th>
                  <th>{t('winnerStat')}</th><th>{t('date')}</th><th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPulls.map(pull => (
                  <tr key={pull.id}>
                    <td data-label={t('pullTitle')} style={{ fontWeight: 600 }}>{pull.title}</td>
                    <td data-label={t('status')}><span className={`badge badge-${pull.status}`}>{statusLabel(pull.status)}</span></td>
                    <td data-label={t('winnerStat')}>{pull.winner_number !== null ? <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{String(pull.winner_number).padStart(2,'0')}</span> : '—'}</td>
                    <td data-label={t('date')} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(pull.created_at).toLocaleDateString()}</td>
                    <td data-label={t('actions')}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link to={`/admin/pulls/${pull.id}`} className="btn btn-sm btn-secondary">
                          <span className="icon"><FiEdit2 /></span>
                          {t('edit')}
                        </Link>
                        <button onClick={() => handleDelete(pull.id, pull.title)} className="btn btn-sm btn-danger" aria-label={t('delete')}>
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
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{t('addPull')}</span>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowCreateModal(false)} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>{t('pullTitle')} *</label>
                <input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required placeholder="e.g." />
              </div>
              <div className="form-group">
                <label>{t('pullDescription')}</label>
                <textarea className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the pull and prizes..." />
              </div>
              <div className="form-group">
                <label>{t('adminPhone')}</label>
                <input className="form-control" value={form.admin_phone} onChange={e => setForm({...form, admin_phone: e.target.value})} placeholder="+961..." required />
              </div>
              <div className="form-group">
                <label>{t('pullPhoto')}</label>
                <input className="form-control" type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? t('loading') : (
                    <>
                      <span className="icon"><FiCheck /></span>
                      {t('createPull')}
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
