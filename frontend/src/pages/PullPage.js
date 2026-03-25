import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { FiAward, FiGift, FiPhone, FiSquare, FiCheckCircle, FiStar, FiCheck, FiX, FiMessageCircle } from 'react-icons/fi';

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
  const { t, lang } = useLang();
  const [pull, setPull] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [drawStarted, setDrawStarted] = useState(false);
  const [reserving, setReserving] = useState(null);
  const [myNumbers, setMyNumbers] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0, affordableNumbers: 0 });
  const [reserveCandidate, setReserveCandidate] = useState(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showContactOptions, setShowContactOptions] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/pulls/${id}`);
      setPull(res.data.pull);
      setNumbers(res.data.numbers);
      const mine = res.data.numbers.filter(n => n.user_id === user?.id);
      setMyNumbers(mine);
      setWallet({
        balance: Number(res.data.currentBalance || 0),
        affordableNumbers: Number(res.data.affordableNumbers || 0)
      });
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

  useEffect(() => {
    if (!showPhotoPreview) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowPhotoPreview(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPhotoPreview]);

  useEffect(() => {
    if (!showContactOptions) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowContactOptions(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showContactOptions]);

  const handleReserve = async (number) => {
    if (reserving || !Number.isFinite(parsedAttemptPrice) || parsedAttemptPrice <= 0 || wallet.balance < parsedAttemptPrice) return;
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

  const openReserveConfirm = (num) => {
    if (!num || reserving || !Number.isFinite(parsedAttemptPrice) || parsedAttemptPrice <= 0 || wallet.balance < parsedAttemptPrice || num.user_id) return;
    setReserveCandidate({ number: num.number, arabic_name: num.arabic_name });
  };

  const closeReserveConfirm = () => {
    if (reserving) return;
    setReserveCandidate(null);
  };

  const confirmReserve = async () => {
    if (!reserveCandidate || reserving) return;
    await handleReserve(reserveCandidate.number);
    setReserveCandidate(null);
  };

  const openPhotoPreview = () => {
    if (!pull?.photo_url) return;
    setShowPhotoPreview(true);
  };

  const closePhotoPreview = () => setShowPhotoPreview(false);
  const openContactOptions = () => {
    if (!pull?.admin_phone) return;
    setShowContactOptions(true);
  };
  const closeContactOptions = () => setShowContactOptions(false);

  const contactViaCall = () => {
    if (!pull?.admin_phone) return;
    window.location.href = `tel:${pull.admin_phone}`;
    setShowContactOptions(false);
  };

  const contactViaWhatsapp = () => {
    const digitsOnly = String(pull?.admin_phone || '').replace(/\D/g, '');
    if (!digitsOnly) {
      toast.error(t('errorGeneric'));
      return;
    }
    window.location.href = `https://wa.me/${digitsOnly}`;
    setShowContactOptions(false);
  };

  const takenCount = numbers.filter(n => n.user_id).length;
  const statusLabel = pull?.status === 'active' ? t('statusActive') : pull?.status === 'completed' ? t('statusCompleted') : t('statusClosed');
  const parsedAttemptPrice = Number.parseFloat(pull?.attempt_price);
  const attemptPriceText = Number.isFinite(parsedAttemptPrice) && parsedAttemptPrice > 0
    ? parsedAttemptPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  if (loading) return (
    <Layout title={t('pull')}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
    </Layout>
  );

  return (
    <Layout title={pull?.title || t('pull')}>
      {showPhotoPreview && pull?.photo_url && (
        <div className="modal-overlay" onClick={closePhotoPreview}>
          <div className="modal" style={{ maxWidth: 'min(94vw, 860px)', padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button className="btn btn-icon btn-secondary" onClick={closePhotoPreview} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <img
              src={pull.photo_url}
              alt={pull.title}
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, display: 'block' }}
            />
          </div>
        </div>
      )}

      {reserveCandidate && (
        <div className="modal-overlay" onClick={closeReserveConfirm}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '1rem' }}>
              <div className="modal-title">{lang === 'ar' ? 'تأكيد الحجز' : 'Confirm Reservation'}</div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '2.6rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                {String(reserveCandidate.number).padStart(2, '0')}
              </div>
              <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                {reserveCandidate.arabic_name || '-'}
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-sm btn-secondary"
                onClick={closeReserveConfirm}
                disabled={reserving === reserveCandidate.number}
              >
                {t('cancel')}
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={confirmReserve}
                disabled={reserving === reserveCandidate.number}
              >
                {reserving === reserveCandidate.number ? t('loading') : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactOptions && pull?.admin_phone && (
        <div className="modal-overlay" onClick={closeContactOptions}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '0.75rem' }}>
              <div className="modal-title">{t('contactAdminTitle')}</div>
              <button className="btn btn-icon btn-secondary" onClick={closeContactOptions} aria-label={t('close')}>
                <FiX />
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.92rem' }}>
              {t('contactAdminPrompt')}
            </div>
            <div className="contact-options-grid">
              <button type="button" className="btn btn-secondary contact-option-btn" onClick={contactViaCall}>
                <span className="icon"><FiPhone /></span>
                {t('contactByCall')}
              </button>
              <button type="button" className="btn btn-primary contact-option-btn" onClick={contactViaWhatsapp}>
                <span className="icon"><FiMessageCircle /></span>
                {t('contactByWhatsapp')}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <button
              type="button"
              onClick={openPhotoPreview}
              style={{ background: 'transparent', border: 'none', padding: 0, borderRadius: 12, cursor: 'zoom-in', flexShrink: 0 }}
              aria-label={t('pullPhoto')}
            >
              <img src={pull.photo_url} alt={pull.title} style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, display: 'block' }} />
            </button>
          )}
          <div className="pull-header-details" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{pull.title}</h1>
              <span className={`badge badge-${pull.status}`}>{statusLabel}</span>
              {drawStarted && <span className="live-badge"><span className="live-dot" />{t('liveBroadcast')}</span>}
            </div>
            {pull.description && (
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', whiteSpace: 'pre-line' }}>
                {pull.description}
              </p>
            )}
            <div className="pull-metrics" style={{ fontSize: '0.9rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('reserved')}: </span>
                <strong style={{ color: 'var(--danger)' }}>{takenCount}</strong>
              </div>
              <div><span style={{ color: 'var(--text-muted)' }}>{t('available')}: </span>
                <strong style={{ color: 'var(--success)' }}>{100 - takenCount}</strong>
              </div>
              <div className="attempts-highlight">
                <span className="attempts-label">{t('currentBalance')}:</span>
                <strong className={`attempts-value ${wallet.balance >= parsedAttemptPrice ? 'positive' : 'zero'}`}>
                  {wallet.balance.toFixed(2)}
                </strong>
              </div>
              {attemptPriceText && (
                <div className="attempts-highlight">
                  <span className="attempts-label">{t('attemptPrice')}:</span>
                  <strong className="attempts-value positive">{attemptPriceText}</strong>
                </div>
              )}
              <div className="attempts-highlight">
                <span className="attempts-label">{t('canBuyNumbers')}:</span>
                <strong className="attempts-value positive">{wallet.affordableNumbers}</strong>
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
                {t('contactAdmin')}: <button type="button" onClick={openContactOptions} style={{ background: 'transparent', border: 'none', color: 'var(--primary-light)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>{pull.admin_phone}</button>
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
          <div className="numbers-legend">
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

        <div className="numbers-grid show-mobile-names">
          {numbers.map(num => {
            const isWinner = pull.winner_number === num.number;
            const isMine = num.user_id === user?.id;
            const isTaken = !!num.user_id && !isMine;
            const canClick = pull.status === 'active' && !isTaken && !isMine && Number.isFinite(parsedAttemptPrice) && parsedAttemptPrice > 0 && wallet.balance >= parsedAttemptPrice;
            return (
              <div key={num.number}
                className={`number-cell ${isTaken ? 'taken' : ''} ${isMine ? 'mine' : ''} ${isWinner ? 'winner-cell' : ''} ${!canClick && !isMine ? 'disabled' : ''}`}
                onClick={() => canClick && openReserveConfirm(num)}
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
