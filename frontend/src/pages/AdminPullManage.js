import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { FiArrowLeft, FiArrowRight, FiEdit2, FiX, FiSave, FiHash, FiXCircle, FiCheckCircle, FiAward, FiRadio, FiActivity, FiTarget, FiChevronDown } from 'react-icons/fi';

let socket;

export default function AdminPullManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, isRTL } = useLang();
  const [pull, setPull] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [photo, setPhoto] = useState(null);
  const [selectedWinner, setSelectedWinner] = useState('');
  const [winnerQuery, setWinnerQuery] = useState('');
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  const [drawLive, setDrawLive] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/pulls/${id}`);
      setPull(res.data.pull);
      setNumbers(res.data.numbers);
      setForm({
        title: res.data.pull.title,
        description: res.data.pull.description || '',
        admin_phone: res.data.pull.admin_phone || '',
        status: res.data.pull.status
      });
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchData();
    socket = io('/', { path: '/socket.io' });
    socket.emit('join_pull', id);
    return () => { socket.disconnect(); };
  }, [id, fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => fd.append(k, form[k]));
      if (photo) fd.append('photo', photo);
      await api.put(`/pulls/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(t('pullUpdated'));
      setEditing(false);
      fetchData();
    } catch { toast.error(t('errorSave')); }
    finally { setSaving(false); }
  };

  const handleStartDraw = () => {
    setDrawLive(true);
    socket.emit('start_draw', id);
    toast.info(t('liveStarted'));
  };

  const handleAnnounceWinner = async () => {
    const parsedWinner = Number.parseInt(selectedWinner, 10);
    if (!Number.isInteger(parsedWinner)) { toast.error(t('selectWinner')); return; }
    if (!numbers.some(n => n.number === parsedWinner)) { toast.error(t('selectWinner')); return; }
    if (!window.confirm(`${t('announceConfirm')} ${String(parsedWinner).padStart(2,'0')}?`)) return;
    setAnnouncing(true);
    try {
      await api.post(`/pulls/${id}/winner`, { winner_number: parsedWinner });
      toast.success(t('winnerAnnounced'));
      setDrawLive(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || t('errorGeneric')); }
    finally { setAnnouncing(false); }
  };

  const takenCount = numbers.filter(n => n.user_id).length;
  const winnerInfo = pull?.winner_number !== null ? numbers.find(n => n.number === pull.winner_number) : null;
  const selectedInfo = selectedWinner !== '' ? numbers.find(n => n.number === parseInt(selectedWinner)) : null;
  const normalizedWinnerQuery = winnerQuery.trim().toLowerCase();
  const winnerTokens = normalizedWinnerQuery.split(/[\s\-()@]+/).filter(Boolean);
  const filteredNumbers = numbers.filter(n => {
    if (winnerTokens.length === 0) return true;
    const numberLabel = String(n.number).padStart(2, '0');
    const fields = [
      numberLabel,
      n.arabic_name,
      n.username,
      n.full_name
    ].filter(Boolean).map(v => String(v).toLowerCase());
    return winnerTokens.every(token => fields.some(v => v.includes(token)));
  });

  const formatWinnerOption = (n) => {
    const numberLabel = String(n.number).padStart(2, '0');
    const nameLabel = n.arabic_name ? ` - ${n.arabic_name}` : '';
    const userLabel = n.username ? ` (@${n.username})` : ` (${t('noWinner')})`;
    return `${numberLabel}${nameLabel}${userLabel}`;
  };

  const handleWinnerInputChange = (e) => {
    const value = e.target.value;
    setWinnerQuery(value);
    setWinnerOpen(true);
    const trimmed = value.trim();
    if (!trimmed) { setSelectedWinner(''); return; }
    const match = trimmed.match(/^\d{1,2}$/);
    if (match) {
      setSelectedWinner(String(parseInt(match[0], 10)));
    } else {
      setSelectedWinner('');
    }
  };

  const handleWinnerSelect = (n) => {
    setSelectedWinner(String(n.number));
    setWinnerQuery(formatWinnerOption(n));
    setWinnerOpen(false);
  };

  if (loading) return (
    <Layout title={t('managePull')}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </Layout>
  );

  return (
    <Layout title={`${t('managePull')}: ${pull.title}`}>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>
          <span className="icon">{isRTL ? <FiArrowRight /> : <FiArrowLeft />}</span>
          {t('back')}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing(!editing)}>
          {editing ? (
            <>
              <span className="icon"><FiX /></span>
              {t('cancel')}
            </>
          ) : (
            <>
              <span className="icon"><FiEdit2 /></span>
              {t('edit')}
            </>
          )}
        </button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><span className="card-title">{t('editPull')}</span></div>
          <form onSubmit={handleSave}>
            <div className="grid grid-2">
              <div className="form-group">
                <label>{t('pullTitle')}</label>
                <input className="form-control" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>{t('status')}</label>
                <select className="form-control" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">{t('active')}</option>
                  <option value="closed">{t('closed')}</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>{t('pullDescription')}</label>
              <textarea className="form-control" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="form-group">
              <label>{t('adminPhone')}</label>
              <input className="form-control" value={form.admin_phone} onChange={e => setForm({...form, admin_phone: e.target.value})} placeholder="" required />
            </div>
            <div className="form-group">
              <label>{t('pullPhoto')}</label>
              <input className="form-control" type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>{t('cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('loading') : (
                  <>
                    <span className="icon"><FiSave /></span>
                    {t('save')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
        {[
          { Icon: FiHash, val: 100, label: t('totalNumbers'), cls: 'purple' },
          { Icon: FiXCircle, val: takenCount, label: t('reservedCount'), cls: 'red' },
          { Icon: FiCheckCircle, val: 100 - takenCount, label: t('availableCount'), cls: 'green' },
          { Icon: FiAward, val: pull.winner_number !== null ? String(pull.winner_number).padStart(2,'0') : '—', label: t('winnerStat'), cls: 'gold' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${s.cls}`}><s.Icon /></div>
            <div><div className="stat-value">{s.val}</div><div className="stat-label">{s.label}</div></div>
          </div>
        ))}
      </div>

      {pull.status !== 'completed' && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(255,209,102,0.3)' }}>
          <div className="card-header">
            <span className="card-title">
              <span className="icon"><FiTarget /></span>
              {t('drawSection')}
            </span>
            {drawLive && <span className="live-badge"><span className="live-dot" />{t('liveBroadcast')}</span>}
          </div>
          {!drawLive ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{t('drawLive')}</p>
              <button className="btn btn-warning" onClick={handleStartDraw}>
                <span className="icon"><FiRadio /></span>
                {t('startLiveDraw')}
              </button>
            </div>
          ) : (
            <div>
              <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
                <span className="icon"><FiActivity /></span>
                <span>{t('drawLive')}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group combo-box" style={{ flex: 1, margin: 0 }}>
                  <label>{t('winningNumber')}</label>
                  <div className="combo-input-wrap">
                    <input
                      className="form-control combo-input"
                      value={winnerQuery}
                      onChange={handleWinnerInputChange}
                      onFocus={() => setWinnerOpen(true)}
                      onBlur={() => setTimeout(() => setWinnerOpen(false), 120)}
                      placeholder={t('selectWinner')}
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={winnerOpen}
                      aria-controls="winner-options"
                      aria-autocomplete="list"
                    />
                    <span className="combo-caret"><FiChevronDown /></span>
                  </div>
                  {winnerOpen && (
                    <div className="combo-list" id="winner-options" role="listbox">
                      {filteredNumbers.map(n => {
                        const isActive = String(n.number) === String(selectedWinner);
                        return (
                          <div
                            key={n.number}
                            className={`combo-option ${isActive ? 'active' : ''}`}
                            role="option"
                            aria-selected={isActive}
                            onMouseDown={(e) => { e.preventDefault(); handleWinnerSelect(n); }}
                          >
                            <span className="combo-option-main">{String(n.number).padStart(2,'0')}</span>
                            <span className="combo-option-meta">
                              {n.arabic_name || t('noWinner')}
                              {n.username ? ` (@${n.username})` : ''}
                            </span>
                          </div>
                        );
                      })}
                      {filteredNumbers.length === 0 && (
                        <div className="combo-empty">{t('noResults')}</div>
                      )}
                    </div>
                  )}
                </div>
                <button className="btn btn-success" disabled={!selectedWinner || announcing} onClick={handleAnnounceWinner}>
                  {announcing ? t('loading') : t('announceWinner')}
                </button>
              </div>
              {selectedInfo && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg2)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{t('winnerLabel')}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {selectedInfo.full_name || t('noWinner')}
                    {selectedInfo.username ? ` (@${selectedInfo.username})` : ''}
                  </div>
                  {selectedInfo.phone_number && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{selectedInfo.phone_number}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pull.winner_number !== null && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <span className="card-title">
              <span className="icon"><FiAward /></span>
              {t('winnerLabel')}
            </span>
          </div>
          {winnerInfo && winnerInfo.user_id ? (
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
              <div><strong>{t('fullName')}:</strong> {winnerInfo.full_name || '—'}</div>
              <div><strong>{t('username')}:</strong> {winnerInfo.username ? `@${winnerInfo.username}` : '—'}</div>
              <div><strong>{t('phoneNumber')}:</strong> {winnerInfo.phone_number || '—'}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>{t('noWinner')}</div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">{t('pickNumber')}</span></div>
        <div className="numbers-grid">
          {numbers.map(num => {
            const isWinner = pull.winner_number === num.number;
            return (
              <div key={num.number}
                className={`number-cell ${num.user_id ? 'taken' : ''} ${isWinner ? 'winner-cell' : ''}`}
                style={{ cursor: 'default' }}
                title={num.user_id ? `${num.username || ''} - ${num.full_name || ''}` : t('available')}>
                <div className="number-big" style={{ color: isWinner ? 'var(--accent)' : num.user_id ? 'var(--danger)' : 'var(--success)' }}>
                  {String(num.number).padStart(2, '0')}
                </div>
                <div className="number-name">{num.arabic_name}</div>
                {num.user_id && <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textAlign: 'center' }}>{num.username}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header"><span className="card-title">{t('participants')}</span></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('username')}</th><th>#</th><th></th><th>{t('reservedAt')}</th></tr>
            </thead>
            <tbody>
              {numbers.filter(n => n.user_id).map(n => (
                <tr key={n.number}>
                  <td style={{ fontWeight: 600 }}>{n.username} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({n.full_name})</span></td>
                  <td style={{ fontWeight: 800 }}>{String(n.number).padStart(2,'0')}</td>
                  <td>{n.arabic_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{n.reserved_at ? new Date(n.reserved_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {numbers.filter(n => n.user_id).length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{t('noParticipants')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
