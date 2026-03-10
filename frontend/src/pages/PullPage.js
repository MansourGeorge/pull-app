import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiAward, FiGift, FiPhone, FiSquare, FiCheckCircle, FiStar, FiCheck } from 'react-icons/fi';

let socket;

function Confetti() {
  const pieces = Array.from({ length: 60 });
  return (
    <div className="confetti-container">
      {pieces.map((_, i) => (
        <div key={i} className="confetti-piece" style={{
          left: `${Math.random() * 100}%`,
          background: ['#6C63FF','#FF6584','#FFD700','#43e97b','#ff6b35'][Math.floor(Math.random()*5)],
          borderRadius: Math.random() > 0.5 ? '50%' : '0',
          animationDuration: `${2 + Math.random() * 3}s`,
          animationDelay: `${Math.random() * 1}s`,
          transform: `rotate(${Math.random()*360}deg)`,
        }} />
      ))}
    </div>
  );
}

export default function PullPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLang();
  const [pull, setPull] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [drawStarted, setDrawStarted] = useState(false);
  const [reserving, setReserving] = useState(null);
  const [myNumbers, setMyNumbers] = useState([]);
  const [attempts, setAttempts] = useState({ allowed: 0, used: 0, remaining: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/pulls/${id}`);
      setPull(res.data.pull);
      setNumbers(res.data.numbers);
      const mine = res.data.numbers.filter(n => n.user_id === user?.id);
      setMyNumbers(mine);
      const allowedAttempts = res.data.allowedAttempts ?? res.data.userAttempts ?? 1;
      const usedAttempts = res.data.usedAttempts ?? mine.length;
      const remainingAttempts = res.data.remainingAttempts ?? Math.max(allowedAttempts - usedAttempts, 0);
      setAttempts({ allowed: allowedAttempts, used: usedAttempts, remaining: remainingAttempts });
      if (res.data.pull.status === 'completed' && res.data.pull.winner_number !== null) {
        const winNum = res.data.pull.winner_number;
        const winNumObj = res.data.numbers.find(n => n.number === winNum);
        setWinner({ winnerNumber: winNum, winnerName: winNumObj?.arabic_name, winnerUser: winNumObj?.full_name || t('noWinner'), winnerUsername: winNumObj?.username });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, t]);

  useEffect(() => {
    fetchData();
    socket = io('/', { path: '/socket.io' });
    socket.emit('join_pull', id);
    socket.on('winner_announced', (data) => { setWinner(data); setShowWinner(true); setDrawStarted(false); fetchData(); });
    socket.on('draw_started', () => setDrawStarted(true));
    return () => { socket.emit('leave_pull', id); socket.disconnect(); };
  }, [id, fetchData]);

  const handleReserve = async (number) => {
    if (reserving || attempts.remaining <= 0) return;
    const num = numbers.find(n => n.number === number);
    if (num?.user_id) return;
    setReserving(number);
    try {
      await api.post(`/pulls/${id}/reserve`, { number });
      toast.success(`${t('numberReserved')} — ${String(number).padStart(2, '0')}!`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally { setReserving(null); }
  };

  const takenCount = numbers.filter(n => n.user_id).length;
  const statusLabel = pull?.status === 'active' ? t('statusActive') : pull?.status === 'completed' ? t('statusCompleted') : t('statusClosed');

  if (loading) return (
    <Layout title={t('pull')}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </Layout>
  );

  return (
    <Layout title={pull?.title || t('pull')}>
      {showWinner && winner && (
        <>
          <Confetti />
          <div className="winner-overlay">
            <div className="winner-card">
              <div className="winner-emoji"><FiAward /></div>
              <div style={{ marginBottom: '0.5rem', color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem' }}>{t('winningNumber')}</div>
              <div className="winner-number-display">{String(winner.winnerNumber).padStart(2, '0')}</div>
              <div className="winner-arabic-name">{winner.winnerName}</div>
              {winner.winnerUsername === user?.username ? (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(67,233,123,0.1)', borderRadius: 12, border: '1px solid rgba(67,233,123,0.3)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}><FiGift /></div>
                  <div className="winner-user-name">{t('congratulations')} {t('youWon')}</div>
                </div>
              ) : (
                <div className="winner-user-name">{winner.winnerUser}</div>
              )}
              <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setShowWinner(false)}>{t('close')}</button>
            </div>
          </div>
        </>
      )}

      {/* Pull header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {pull.photo_url && (
            <img src={pull.photo_url} alt={pull.title} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{pull.title}</h1>
              <span className={`badge badge-${pull.status}`}>{statusLabel}</span>
              {drawStarted && <span className="live-badge"><span className="live-dot" />{t('liveBroadcast')}</span>}
            </div>
            {pull.description && <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{pull.description}</p>}
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('reserved')}: </span>
                <strong style={{ color: 'var(--danger)' }}>{takenCount}</strong>
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('available')}: </span>
                <strong style={{ color: 'var(--success)' }}>{100 - takenCount}</strong>
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('attempts')}: </span>
                <strong style={{ color: attempts.remaining > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {attempts.used}/{attempts.allowed}
                </strong>
              </div>
            </div>

            {/* Show user's picked number */}
            {myNumbers.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1.25rem', background: 'rgba(67,233,123,0.1)', border: '1px solid rgba(67,233,123,0.3)', borderRadius: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('yourNumbers')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {myNumbers.map(n => (
                    <div key={n.number} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', borderRadius: 999, background: 'rgba(67,233,123,0.12)', border: '1px solid rgba(67,233,123,0.35)' }}>
                      <span style={{ fontWeight: 800, color: 'var(--success)' }}>{String(n.number).padStart(2, '0')}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n.arabic_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pull.admin_phone && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span className="icon" style={{ marginInlineEnd: 6 }}><FiPhone /></span>
                {t('contactAdmin')}: <a href={`tel:${pull.admin_phone}`} style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{pull.admin_phone}</a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Winner display for completed */}
      {pull.status === 'completed' && pull.winner_number !== null && (
        <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.3)', borderRadius: 12, marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('winningNumber')}</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--accent)' }}>{String(pull.winner_number).padStart(2, '0')}</div>
          {winner && <div style={{ color: 'var(--success)', fontWeight: 600 }}>{winner.winnerUser}</div>}
          <button className="btn btn-sm btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setShowWinner(true)}>{t('showCelebration')}</button>
        </div>
      )}

      {/* Numbers grid */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{t('pickNumber')}</span>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
            <span><span className="icon"><FiSquare /></span> {t('legendAvailable')}</span>
            <span style={{ color: 'var(--success)' }}><span className="icon"><FiSquare /></span> {t('legendMine')}</span>
            <span style={{ color: 'var(--danger)' }}><span className="icon"><FiSquare /></span> {t('legendTaken')}</span>
            {pull.winner_number !== null && (
              <span style={{ color: 'var(--accent)' }}><span className="icon"><FiStar /></span> {t('legendWinner')}</span>
            )}
          </div>
        </div>

        {myNumbers.length > 0 && pull.status === 'active' && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <span className="icon"><FiCheckCircle /></span>
            <span>{t('yourNumbers')}: <strong>{myNumbers.map(n => `${String(n.number).padStart(2,'0')} - ${n.arabic_name}`).join(', ')}</strong>.</span>
          </div>
        )}

        <div className="numbers-grid">
          {numbers.map(num => {
            const isWinner = pull.winner_number === num.number;
            const isMine = num.user_id === user?.id;
            const isTaken = !!num.user_id && !isMine;
            const canClick = pull.status === 'active' && !isTaken && !isMine && attempts.remaining > 0;
            return (
              <div key={num.number}
                className={`number-cell ${isTaken ? 'taken' : ''} ${isMine ? 'mine' : ''} ${isWinner ? 'winner-cell' : ''} ${!canClick && !isMine ? 'disabled' : ''}`}
                onClick={() => canClick && handleReserve(num.number)}
                title={isTaken ? `${t('reserved')} — ${num.username || t('user')}` : num.arabic_name}>
                {isWinner && <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.7rem' }}><FiStar /></div>}
                {reserving === num.number ? <div style={{ fontSize: '0.8rem' }}>...</div> : (
                  <>
                    <div className="number-big" style={{ color: isMine ? 'var(--success)' : isTaken ? 'var(--danger)' : isWinner ? 'var(--accent)' : 'var(--text)' }}>
                      {String(num.number).padStart(2, '0')}
                    </div>
                    <div className="number-name">{num.arabic_name}</div>
                    {isMine && (
                      <div style={{ fontSize: '0.6rem', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span className="icon"><FiCheck /></span>
                        {t('mine')}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
