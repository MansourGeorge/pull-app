import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { FiStar, FiInbox, FiGift } from 'react-icons/fi';

export default function LoyaltyPage() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [loyaltyByAdmin, setLoyaltyByAdmin] = useState([]);
  const [redeemCodes, setRedeemCodes] = useState([]);
  const [redeemCodeInput, setRedeemCodeInput] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loyaltyRes, codesRes] = await Promise.all([
        api.get('/users/me/loyalty'),
        api.get('/users/me/redeem-codes').catch(() => ({ data: [] }))
      ]);
      setLoyaltyByAdmin(Array.isArray(loyaltyRes.data) ? loyaltyRes.data : []);
      setRedeemCodes(Array.isArray(codesRes.data) ? codesRes.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
      setLoyaltyByAdmin([]);
      setRedeemCodes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [t]);

  const totals = useMemo(() => {
    const available = loyaltyByAdmin.reduce((sum, item) => sum + Number(item.availableCodesAmount || 0), 0);
    const pending = loyaltyByAdmin.reduce((maxValue, item) => {
      const current = Number(item.pendingReward || 0);
      return current > maxValue ? current : maxValue;
    }, 0);
    return {
      available: Number(available.toFixed(2)),
      pending: Number(pending.toFixed(2))
    };
  }, [loyaltyByAdmin]);

  const handleRedeem = async (e) => {
    e.preventDefault();
    const code = String(redeemCodeInput || '').trim().toUpperCase();
    if (!code || redeeming) return;

    setRedeeming(true);
    try {
      const res = await api.post('/users/me/redeem-code', { code });
      const amount = Number(res.data?.amountAdded || 0).toFixed(2);
      const adminName = res.data?.adminName || '';
      toast.success(`${t('redeemApplied')}: +${amount}${adminName ? ` (${adminName})` : ''}`);
      setRedeemCodeInput('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <Layout title={t('loyalty')}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner" /></div>
      ) : (
        <div className="loyalty-page">
          <div className="card loyalty-redeem-card">
            <div className="card-header loyalty-card-header">
              <span className="card-title">
                <span className="icon"><FiGift /></span>
                {t('redeemCode')}
              </span>
            </div>
            <form onSubmit={handleRedeem} className="loyalty-redeem-form">
              <input
                className="form-control loyalty-redeem-input"
                value={redeemCodeInput}
                onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
                placeholder={t('enterRedeemCode')}
              />
              <button type="submit" className="btn btn-primary" disabled={redeeming || !redeemCodeInput.trim()}>
                {redeeming ? t('loading') : t('applyRedeem')}
              </button>
            </form>
            <div className="loyalty-totals-line">
              {t('redeemAvailable')}: <strong style={{ color: 'var(--success)' }}>{totals.available.toFixed(2)}</strong> | {t('pendingReward')}: <strong>{totals.pending.toFixed(2)}</strong>
            </div>
            {redeemCodes.length > 0 && (
              <div className="loyalty-code-list">
                {redeemCodes.map((codeItem) => (
                  <button
                    key={codeItem.code}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setRedeemCodeInput(String(codeItem.code || '').toUpperCase())}
                    title={`${codeItem.adminName || codeItem.adminUsername}`}
                  >
                    {codeItem.code} (+{Number(codeItem.amount || 0).toFixed(2)})
                  </button>
                ))}
              </div>
            )}
          </div>

          {loyaltyByAdmin.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><FiInbox /></div>
              <div className="empty-state-title">{t('noLoyaltyData')}</div>
            </div>
          ) : (
            <div className="grid grid-auto loyalty-admin-grid">
              {loyaltyByAdmin.map((item) => (
                <div key={item.adminId} className="card loyalty-admin-card">
                  <div className="loyalty-admin-head">
                    <div className="loyalty-admin-title">
                      <span className="icon"><FiStar /></span>
                      <div className="loyalty-admin-name">{item.adminName}</div>
                    </div>
                    <span className="badge badge-primary">{Number(item.loyaltyPercentage || 0).toFixed(2)}%</span>
                  </div>
                  <div className="loyalty-admin-metrics">
                    <div><strong>{t('pendingReward')}:</strong> {Number(item.pendingReward || 0).toFixed(2)}</div>
                    <div><strong>{t('redeemAvailable')}:</strong> {Number(item.availableCodesAmount || 0).toFixed(2)} ({Number(item.availableCodesCount || 0)})</div>
                    <div><strong>{t('totalGeneratedRewards')}:</strong> {Number(item.totalRewardsGenerated || 0).toFixed(2)}</div>
                    <div><strong>{t('totalRedeemedRewards')}:</strong> {Number(item.totalRewardsRedeemed || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
