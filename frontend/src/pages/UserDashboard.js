import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { FiCheckCircle, FiAward, FiGift, FiInbox } from 'react-icons/fi';

export default function UserDashboard() {
  const [pulls, setPulls] = useState([]);
  const [walletTotal, setWalletTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const { t } = useLang();

  useEffect(() => {
    const fetchPulls = async () => {
      setLoading(true);
      try {
        const [pullsRes, walletRes] = await Promise.all([
          api.get('/pulls'),
          api.get('/users/me/wallet-summary').catch(() => ({ data: { totalBalance: 0 } }))
        ]);
        setPulls(pullsRes.data);
        setWalletTotal(Number(walletRes.data?.totalBalance || 0));
      } catch (err) {
        toast.error(err.response?.data?.message || t('errorGeneric'));
        setWalletTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchPulls();
  }, [t]);

  const filtered = pulls.filter(p => p.status === filter);
  const statusLabel = (s) => s === 'active' ? t('statusActive') : s === 'completed' ? t('statusCompleted') : t('statusClosed');

  return (
    <Layout title={t('pulls')}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['active', 'completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
              {f === 'active' ? (
                <>
                  <span className="icon"><FiCheckCircle /></span>
                  {t('active')}
                </>
              ) : (
                <>
                  <span className="icon"><FiAward /></span>
                  {t('completed')}
                </>
              )}
            </button>
          ))}
        </div>
        <div className="attempts-highlight" style={{ marginInlineStart: 'auto' }}>
          <span className="attempts-label">{t('currentBalance')}:</span>
          <strong className={`attempts-value ${walletTotal > 0 ? 'positive' : 'zero'}`}>
            {walletTotal.toFixed(2)}
          </strong>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FiInbox /></div>
          <div className="empty-state-title">{t('noPulls')}</div>
          <p>{t('noPullsDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-auto">
          {filtered.map(pull => (
            <Link key={pull.id} to={`/pull/${pull.id}`} className="pull-card">
              {pull.photo_url
                ? <img src={pull.photo_url} alt={pull.title} className="pull-card-img" onError={e => { e.target.style.display = 'none'; }} />
                : <div className="pull-card-img-placeholder"><FiGift /></div>
              }
              <div className="pull-card-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className={`badge badge-${pull.status}`}>{statusLabel(pull.status)}</span>
                  {pull.winner_number !== null && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                      <span className="icon"><FiAward /></span>
                      {t('winningNumber')}: {String(pull.winner_number).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <div className="pull-card-title">{pull.title}</div>
                <div className="pull-card-meta">{t('adminName')}: {pull.admin_name || pull.admin_username || '-'}</div>
                {pull.description && <div className="pull-card-desc">{pull.description}</div>}
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  {t('clickToParticipate')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
