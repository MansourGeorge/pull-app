import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiClock } from 'react-icons/fi';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { t } = useLang();

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await api.get('/users/me/history');
        setHistory(res.data);
      } catch (err) {
        toast.error(err.response?.data?.message || t('errorGeneric'));
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [t]);

  return (
    <Layout title={t('myHistory')}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FiClock /></div>
          <div className="empty-state-title">{t('noHistory')}</div>
          <p>{t('noHistoryDesc')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {history.map(item => {
            const myNums = item.my_numbers ? item.my_numbers.split(',') : [];
            const myNames = item.my_names ? item.my_names.split(',') : [];
            const isWinner = item.drawn_winner !== null && myNums.includes(String(item.drawn_winner));
            const statusLabel = item.status === 'active' ? t('statusActive') : item.status === 'completed' ? t('statusCompleted') : t('statusClosed');

            return (
              <div key={item.id} className="card" style={{ border: isWinner ? '1px solid var(--accent)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(item.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge badge-${item.status}`}>{statusLabel}</span>
                    {isWinner && <span className="badge" style={{ background: 'rgba(255,209,102,0.2)', color: 'var(--accent)' }}>{t('youAreWinner')}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: item.drawn_winner !== null ? '1rem' : 0 }}>
                  {myNums.map((num, i) => (
                    <span key={i} style={{
                      padding: '0.35rem 0.75rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
                      background: parseInt(num) === item.drawn_winner ? 'rgba(255,209,102,0.2)' : 'rgba(108,99,255,0.1)',
                      border: parseInt(num) === item.drawn_winner ? '1px solid rgba(255,209,102,0.4)' : '1px solid rgba(108,99,255,0.2)',
                      color: parseInt(num) === item.drawn_winner ? 'var(--accent)' : 'var(--primary-light)'
                    }}>
                      {String(num).padStart(2, '0')} {myNames[i] ? `- ${myNames[i]}` : ''}
                    </span>
                  ))}
                </div>
                {item.drawn_winner !== null && (
                  <div style={{ padding: '0.75rem', background: 'var(--bg2)', borderRadius: 8, fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t('drawnWinner')}: </span>
                    <strong style={{ color: 'var(--accent)' }}>{String(item.drawn_winner).padStart(2,'0')} - {item.winner_arabic_name}</strong>
                    {item.winner_full_name && (
                      <> <span style={{ color: 'var(--text-muted)' }}> | {t('winnerIs')}: </span>
                        <strong style={{ color: 'var(--success)' }}>{item.winner_full_name}</strong>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
