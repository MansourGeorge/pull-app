import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Layout from '../components/Layout';
import api from '../utils/api';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { FiBarChart2, FiDollarSign, FiRefreshCw, FiSearch, FiTrendingDown, FiTrendingUp, FiUsers, FiX } from 'react-icons/fi';

const LIMIT = 20;

export default function AdminReportsPage() {
  const { t, lang } = useLang();
  const { user } = useAuth();

  const [activeSection, setActiveSection] = useState('summary');
  const [selectedAdminId, setSelectedAdminId] = useState('');

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  const [admins, setAdmins] = useState([]);

  const [overview, setOverview] = useState({
    totals: {
      givenAmount: 0,
      cashbackAmount: 0,
      netAmount: 0,
      numbersSpentAmount: 0,
      redeemAppliedAmount: 0,
      generatedRewardsAmount: 0
    },
    byAdmin: []
  });

  const [activitySearchInput, setActivitySearchInput] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [activity, setActivity] = useState({
    users: [],
    total: 0,
    limit: LIMIT
  });

  const isMainAdmin = user?.role === 'admin';
  const activityPageCount = Math.max(1, Math.ceil(Number(activity.total || 0) / Number(activity.limit || LIMIT)));

  const moneyFormatter = useMemo(
    () => new Intl.NumberFormat(lang === 'ar' ? 'ar-LB' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    [lang]
  );
  const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

  const roleLabel = (role) => (role === 'subadmin' ? t('subadminLabel') : t('admin'));

  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const params = {};
      if (selectedAdminId) params.adminId = Number(selectedAdminId);

      const res = await api.get('/reports/overview', { params });
      setAdmins(Array.isArray(res.data?.admins) ? res.data.admins : []);
      setOverview({
        totals: res.data?.totals || {
          givenAmount: 0,
          cashbackAmount: 0,
          netAmount: 0,
          numbersSpentAmount: 0,
          redeemAppliedAmount: 0,
          generatedRewardsAmount: 0
        },
        byAdmin: Array.isArray(res.data?.byAdmin) ? res.data.byAdmin : []
      });
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
      setOverview({
        totals: {
          givenAmount: 0,
          cashbackAmount: 0,
          netAmount: 0,
          numbersSpentAmount: 0,
          redeemAppliedAmount: 0,
          generatedRewardsAmount: 0
        },
        byAdmin: []
      });
    } finally {
      setOverviewLoading(false);
    }
  };

  const fetchActivity = async () => {
    setActivityLoading(true);
    try {
      const params = {
        page: activityPage,
        limit: LIMIT
      };
      if (selectedAdminId) params.adminId = Number(selectedAdminId);
      if (activitySearch.trim()) params.search = activitySearch.trim();

      const res = await api.get('/reports/user-activity', { params });
      setAdmins(Array.isArray(res.data?.admins) ? res.data.admins : []);
      setActivity({
        users: Array.isArray(res.data?.users) ? res.data.users : [],
        total: Number(res.data?.total || res.data?.totalUsers || 0),
        limit: Number(res.data?.limit || LIMIT)
      });
    } catch (err) {
      toast.error(err.response?.data?.message || t('errorGeneric'));
      setActivity({ users: [], total: 0, limit: LIMIT });
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [selectedAdminId]);

  useEffect(() => {
    fetchActivity();
  }, [selectedAdminId, activityPage, activitySearch]);

  useEffect(() => {
    if (!selectedAdminId || !admins.length) return;
    const stillExists = admins.some((admin) => String(admin.id) === String(selectedAdminId));
    if (!stillExists) {
      setSelectedAdminId('');
      setActivityPage(1);
    }
  }, [admins, selectedAdminId]);

  const handleActivitySearchSubmit = (e) => {
    e.preventDefault();
    setActivityPage(1);
    setActivitySearch(String(activitySearchInput || '').trim());
  };

  const clearActivitySearch = () => {
    setActivitySearchInput('');
    setActivityPage(1);
    setActivitySearch('');
  };

  return (
    <Layout title={t('reports')}>
      <div className="reports-page">
        <div className="card report-card">
          <div className="reports-tabs">
            <button
              type="button"
              className={`report-tab-btn ${activeSection === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveSection('summary')}
            >
              <span className="icon"><FiBarChart2 /></span>
              {t('fundingSummaryTitle')}
            </button>
            <button
              type="button"
              className={`report-tab-btn ${activeSection === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveSection('activity')}
            >
              <span className="icon"><FiUsers /></span>
              {t('userActivityLedgerTitle')}
            </button>
          </div>
        </div>

        {activeSection === 'summary' ? (
          <div className="card report-card">
            <div className="card-header">
              <span className="card-title">
                <span className="icon"><FiBarChart2 /></span>
                {t('fundingSummaryTitle')}
              </span>
              <div className="reports-toolbar-actions">
                {isMainAdmin && (
                  <select
                    className="form-control reports-admin-filter"
                    value={selectedAdminId}
                    onChange={(e) => {
                      setSelectedAdminId(e.target.value);
                      setActivityPage(1);
                    }}
                  >
                    <option value="">{t('allAdmins')}</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.fullName} ({roleLabel(admin.role)})
                      </option>
                    ))}
                  </select>
                )}
                <button className="btn btn-sm btn-secondary" onClick={fetchOverview}>
                  <span className="icon"><FiRefreshCw /></span>
                  {t('refreshReports')}
                </button>
              </div>
            </div>

            {overviewLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
            ) : (
              <>
                <div className="grid grid-4 report-stats">
                  <div className="stat-card">
                    <div className="stat-icon green"><FiTrendingUp /></div>
                    <div>
                      <div className="stat-value">{formatMoney(overview.totals.givenAmount)}</div>
                      <div className="stat-label">{t('givenToUsers')}</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon red"><FiTrendingDown /></div>
                    <div>
                      <div className="stat-value">{formatMoney(overview.totals.cashbackAmount)}</div>
                      <div className="stat-label">{t('cashback')}</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon purple"><FiDollarSign /></div>
                    <div>
                      <div className="stat-value">{formatMoney(overview.totals.netAmount)}</div>
                      <div className="stat-label">{t('netFunding')}</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon gold"><FiUsers /></div>
                    <div>
                      <div className="stat-value">{formatMoney(overview.totals.numbersSpentAmount)}</div>
                      <div className="stat-label">{t('numbersSpent')}</div>
                    </div>
                  </div>
                </div>

                <div className="report-table-wrap">
                  <table className="report-table report-table--summary">
                    <thead>
                      <tr>
                        <th>{t('adminName')}</th>
                        <th>{t('status')}</th>
                        <th>{t('givenToUsers')}</th>
                        <th>{t('cashback')}</th>
                        <th>{t('netFunding')}</th>
                        <th>{t('numbersSpent')}</th>
                        <th>{t('redeemAppliedAmount')}</th>
                        <th>{t('generatedRewards')}</th>
                        <th>{t('totalUsers')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.byAdmin.length === 0 ? (
                        <tr className="report-empty-row">
                          <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.2rem' }}>
                            {t('noReportData')}
                          </td>
                        </tr>
                      ) : (
                        overview.byAdmin.map((row) => (
                          <tr key={row.adminId}>
                            <td data-label={t('adminName')}>{row.adminName}</td>
                            <td data-label={t('status')}>{roleLabel(row.role)}</td>
                            <td data-label={t('givenToUsers')}>{formatMoney(row.givenAmount)}</td>
                            <td data-label={t('cashback')}>{formatMoney(row.cashbackAmount)}</td>
                            <td data-label={t('netFunding')}>{formatMoney(row.netAmount)}</td>
                            <td data-label={t('numbersSpent')}>{formatMoney(row.numbersSpentAmount)}</td>
                            <td data-label={t('redeemAppliedAmount')}>{formatMoney(row.redeemAppliedAmount)}</td>
                            <td data-label={t('generatedRewards')}>{formatMoney(row.generatedRewardsAmount)}</td>
                            <td data-label={t('totalUsers')}>{row.usersCount}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="card report-card">
            <div className="card-header">
              <span className="card-title">
                <span className="icon"><FiUsers /></span>
                {t('userActivityLedgerTitle')}
              </span>
            </div>

            <div className="reports-toolbar">
              <form className="reports-search-form" onSubmit={handleActivitySearchSubmit}>
                <div className="search-bar reports-search-bar">
                  <span className="icon"><FiSearch /></span>
                  <input
                    type="text"
                    value={activitySearchInput}
                    onChange={(e) => setActivitySearchInput(e.target.value)}
                    placeholder={`${t('search')} (${t('fullName')} / ${t('username')} / ${t('phoneNumber')})`}
                    aria-label={t('search')}
                  />
                </div>
                <button type="submit" className="btn btn-sm btn-primary">{t('search')}</button>
                {(activitySearch || activitySearchInput) && (
                  <button type="button" className="btn btn-sm btn-secondary" onClick={clearActivitySearch}>
                    <span className="icon"><FiX /></span>
                    {t('cancel')}
                  </button>
                )}
              </form>

              <div className="reports-toolbar-actions">
                {isMainAdmin && (
                  <select
                    className="form-control reports-admin-filter"
                    value={selectedAdminId}
                    onChange={(e) => {
                      setSelectedAdminId(e.target.value);
                      setActivityPage(1);
                    }}
                  >
                    <option value="">{t('allAdmins')}</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.fullName} ({roleLabel(admin.role)})
                      </option>
                    ))}
                  </select>
                )}
                <button className="btn btn-sm btn-secondary" onClick={fetchActivity}>
                  <span className="icon"><FiRefreshCw /></span>
                  {t('refreshReports')}
                </button>
              </div>
            </div>

            {activityLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="spinner" /></div>
            ) : (
              <>
                <div className="report-table-wrap">
                  <table className="report-table report-table--activity">
                    <thead>
                      <tr>
                        <th>{t('username')}</th>
                        <th>{t('givenToUsers')}</th>
                        <th>{t('cashback')}</th>
                        <th>{t('netFunding')}</th>
                        <th>{t('numbersSpent')}</th>
                        <th>{t('redeemAppliedAmount')}</th>
                        <th>{t('generatedRewards')}</th>
                        <th>{t('actions')}</th>
                        <th>{t('date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.users.length === 0 ? (
                        <tr className="report-empty-row">
                          <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.2rem' }}>
                            {activitySearch ? t('noResults') : t('noReportData')}
                          </td>
                        </tr>
                      ) : (
                        activity.users.map((row) => (
                          <tr key={row.userId}>
                            <td data-label={t('username')} className="report-user-cell">
                              <div style={{ fontWeight: 700 }}>{row.fullName || row.username || '-'}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>@{row.username || '-'}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{row.phoneNumber || '-'}</div>
                            </td>
                            <td data-label={t('givenToUsers')}>{formatMoney(row.givenAmount)}</td>
                            <td data-label={t('cashback')}>{formatMoney(row.cashbackAmount)}</td>
                            <td data-label={t('netFunding')}>{formatMoney(row.netAmount)}</td>
                            <td data-label={t('numbersSpent')}>{formatMoney(row.numbersSpentAmount)}</td>
                            <td data-label={t('redeemAppliedAmount')}>{formatMoney(row.redeemAppliedAmount)}</td>
                            <td data-label={t('generatedRewards')}>{formatMoney(row.generatedRewardsAmount)}</td>
                            <td data-label={t('actions')}>{row.activityCount}</td>
                            <td data-label={t('date')}>{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleString() : '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {activityPageCount > 1 && (
                  <div className="reports-pagination">
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={activityPage <= 1}
                      onClick={() => setActivityPage((prev) => Math.max(1, prev - 1))}
                    >
                      {t('previousPage')}
                    </button>
                    <span style={{ alignSelf: 'center', color: 'var(--text-muted)' }}>
                      {activityPage} / {activityPageCount}
                    </span>
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={activityPage >= activityPageCount}
                      onClick={() => setActivityPage((prev) => Math.min(activityPageCount, prev + 1))}
                    >
                      {t('nextPage')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
