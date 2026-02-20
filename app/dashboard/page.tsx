'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase';

type ViewMode = 'net_worth' | 'cash_flow';
type Scope = 'total' | 'liquid';

interface ProjectionPoint {
  date: string;
  value: number;
}

interface ProjectionResponse {
  points: ProjectionPoint[];
  startingValue: number;
  metadata: {
    viewMode: ViewMode;
    scope: Scope;
    accountsIncluded: number;
    rulesApplied: number;
  };
}

interface Account {
  id: string;
  name: string;
  type: 'depository' | 'credit';
  subtype: string;
  last_four: string | null;
  is_liquid: boolean;
  is_primary_payment: boolean;
  payment_day_of_month: number | null;
  latest_balance: number;
  last_synced: string | null;
}

interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'once';
  anchor_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [viewMode, setViewMode] = useState<ViewMode>('net_worth');
  const [scope, setScope] = useState<Scope>('total');
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<number>(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [rulesModalError, setRulesModalError] = useState<string | null>(null);
  const [rulesFormData, setRulesFormData] = useState({
    name: '',
    amount: '',
    frequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'once',
    anchor_date: '',
    end_date: '',
    active: true,
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/accounts/refresh', { method: 'POST' });
      await fetchAccounts();
    } catch {
      // fetchAccounts handles its own error state
    } finally {
      setIsRefreshing(false);
    }
  };

  async function handleDeleteAccount(id: string) {
    setDeleteError(null);
    try {
      const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete account');
      }
      const remaining = accounts.filter(a => a.id !== id);
      setAccounts(remaining);
      setConfirmDeleteId(null);
      if (remaining.length > 0) {
        await fetchProjection();
      } else {
        setProjection(null);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  }

  const formatTimeAgo = (isoString: string | null): string => {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0 || projection !== null) {
      fetchProjection();
    }
  }, [viewMode, scope, accounts.length, timeFrame]);

  async function fetchProjection() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projection?days=${timeFrame}&viewMode=${viewMode}&scope=${scope}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`Failed to fetch projection: ${response.status}`);
      }

      const data: ProjectionResponse = await response.json();
      setProjection(data);
    } catch (err) {
      console.error('Error fetching projection:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projection');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAccounts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/accounts');

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }

      const data: Account[] = await response.json();
      setAccounts(data);

      // Fetch projection after accounts are loaded
      if (data.length > 0) {
        await fetchProjection();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatChartDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  const chartData = projection?.points.map((point) => ({
    date: formatChartDate(point.date),
    value: point.value,
    fullDate: point.date,
  })) || [];

  // Find primary account
  const primaryAccount = accounts.find(acc => acc.is_primary_payment);

  // Rules modal handlers
  function openRulesModal() {
    setRulesFormData({
      name: '',
      amount: '',
      frequency: 'monthly',
      anchor_date: '',
      end_date: '',
      active: true,
    });
    setRulesModalError(null);
    setShowRulesModal(true);
  }

  function closeRulesModal() {
    setShowRulesModal(false);
    setRulesModalError(null);
  }

  async function handleRulesSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRulesModalError(null);

    const amount = parseFloat(rulesFormData.amount);
    if (isNaN(amount) || amount === 0) {
      setRulesModalError('Amount must be a non-zero number');
      return;
    }

    const payload = {
      name: rulesFormData.name,
      amount,
      frequency: rulesFormData.frequency,
      anchor_date: rulesFormData.anchor_date,
      end_date: rulesFormData.end_date || null,
      active: rulesFormData.active,
    };

    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create rule');
      }

      closeRulesModal();
      // Refetch projection to reflect new rule
      if (accounts.length > 0) {
        await fetchProjection();
      }
    } catch (err) {
      console.error('Error saving rule:', err);
      setRulesModalError(err instanceof Error ? err.message : 'Failed to save rule');
    }
  }

  // Calculate current value based on view mode
  const currentValue = projection?.points[projection.points.length - 1]?.value ?? 0;
  const currentValueLabel = viewMode === 'net_worth' 
    ? (scope === 'total' ? 'Total Net Worth' : 'Liquid Net Worth')
    : 'Primary Account Balance';

  // Group accounts by type
  const checkingSavings = accounts.filter(acc => 
    acc.type === 'depository' && ['checking', 'savings'].includes(acc.subtype)
  );
  const creditCards = accounts.filter(acc => acc.type === 'credit');
  const retirement = accounts.filter(acc => 
    acc.type === 'depository' && !acc.is_liquid
  );

  // Empty state
  if (!loading && accounts.length === 0) {
    return (
      <div className="min-h-screen bg-cream p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
            <h1 className="font-heading text-3xl md:text-5xl text-charcoal">
              Financial Projections
            </h1>
            <button
              onClick={handleSignOut}
              className="self-start md:self-auto bg-white text-charcoal border border-border-subtle px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity"
            >
              Sign Out
            </button>
          </div>

          <div className="bg-white border border-border-subtle rounded-lg p-12">
            <h2 className="font-heading text-2xl text-charcoal mb-2 text-center">
              Get started in 3 steps
            </h2>
            <p className="font-body text-charcoal/60 mb-10 text-center">
              Connect your bank, set your rules, see your future.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-terra text-white font-heading text-xl flex items-center justify-center mx-auto mb-4">
                  1
                </div>
                <h3 className="font-body font-semibold text-charcoal mb-2">Connect</h3>
                <p className="font-body text-sm text-charcoal/60">
                  Link your bank accounts securely through Teller.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-2 border-border-subtle text-charcoal/30 font-heading text-xl flex items-center justify-center mx-auto mb-4">
                  2
                </div>
                <h3 className="font-body font-semibold text-charcoal/40 mb-2">Configure</h3>
                <p className="font-body text-sm text-charcoal/40">
                  Add recurring income and expenses to improve accuracy.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-2 border-border-subtle text-charcoal/30 font-heading text-xl flex items-center justify-center mx-auto mb-4">
                  3
                </div>
                <h3 className="font-body font-semibold text-charcoal/40 mb-2">Project</h3>
                <p className="font-body text-sm text-charcoal/40">
                  View 60-day projections for net worth and cash flow.
                </p>
              </div>
            </div>

            <div className="text-center">
              <a
                href="/connect"
                className="inline-block bg-terra text-white px-10 py-3 rounded-lg font-body hover:opacity-90 transition-opacity"
              >
                Connect Your Bank
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <h1 className="font-heading text-3xl md:text-5xl text-charcoal">
            Financial Projections
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-white text-charcoal border border-border-subtle px-4 py-2 rounded-lg font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isRefreshing ? 'Syncing...' : 'Sync Balances'}
            </button>
            <button
              onClick={openRulesModal}
              className="bg-white text-charcoal border border-border-subtle px-4 py-2 rounded-lg font-body text-sm hover:opacity-90 transition-opacity"
            >
              Manage Rules
            </button>
            <a
              href="/connect"
              className="bg-terra text-white px-4 py-2 rounded-lg font-body text-sm hover:opacity-90 transition-opacity"
            >
              + Add Account
            </a>
            <button
              onClick={handleSignOut}
              className="bg-white text-charcoal border border-border-subtle px-4 py-2 rounded-lg font-body text-sm hover:opacity-90 transition-opacity"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setViewMode('net_worth')}
              className={`px-6 py-2 rounded-full font-body transition-colors ${
                viewMode === 'net_worth'
                  ? 'bg-terra text-white'
                  : 'bg-white text-charcoal border border-border-subtle'
              }`}
            >
              Net Worth
            </button>
            <button
              onClick={() => setViewMode('cash_flow')}
              className={`px-6 py-2 rounded-full font-body transition-colors ${
                viewMode === 'cash_flow'
                  ? 'bg-terra text-white'
                  : 'bg-white text-charcoal border border-border-subtle'
              }`}
            >
              Cash Flow
            </button>
          </div>

          {viewMode === 'net_worth' && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setScope('total')}
                className={`px-6 py-2 rounded-full font-body transition-colors ${
                  scope === 'total'
                    ? 'bg-terra text-white'
                    : 'bg-white text-charcoal border border-border-subtle'
                }`}
              >
                Total
              </button>
              <button
                onClick={() => setScope('liquid')}
                className={`px-6 py-2 rounded-full font-body transition-colors ${
                  scope === 'liquid'
                    ? 'bg-terra text-white'
                    : 'bg-white text-charcoal border border-border-subtle'
                }`}
              >
                Liquid
              </button>
            </div>
          )}
        </div>

        {/* Current Value Card */}
        {projection && (
          <div className="bg-white border border-border-subtle rounded-lg p-6 mb-8 shadow-sm max-w-md">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {viewMode === 'cash_flow' && primaryAccount ? (
                  <>
                    <h3 className="font-body text-lg text-charcoal/60 mb-1">
                      {primaryAccount.name} ending in {primaryAccount.last_four || '****'}
                    </h3>
                    <p className="font-body text-sm text-charcoal/60 mb-2">Primary Account Balance</p>
                  </>
                ) : (
                  <h3 className="font-body text-lg text-charcoal/60 mb-2">{currentValueLabel}</h3>
                )}
                <p className="font-heading text-4xl text-charcoal">
                  {formatCurrency(currentValue)}
                </p>
              </div>
              {viewMode === 'cash_flow' && (
                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => setTimeFrame(30)}
                    className={`px-4 py-2 rounded-lg font-body text-sm transition-colors ${
                      timeFrame === 30
                        ? 'bg-terra text-white'
                        : 'bg-white text-charcoal border border-border-subtle hover:opacity-90'
                    }`}
                  >
                    30 days
                  </button>
                  <button
                    onClick={() => setTimeFrame(45)}
                    className={`px-4 py-2 rounded-lg font-body text-sm transition-colors ${
                      timeFrame === 45
                        ? 'bg-terra text-white'
                        : 'bg-white text-charcoal border border-border-subtle hover:opacity-90'
                    }`}
                  >
                    45 days
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projection Chart */}
        <div className="bg-white border border-border-subtle rounded-lg p-4 md:p-6 mb-8 shadow-sm">
          {loading ? (
            <div className="h-96 animate-pulse">
              <div className="h-4 bg-charcoal/8 rounded w-40 mb-6" />
              <div className="h-80 bg-charcoal/5 rounded-lg" />
            </div>
          ) : error ? (
            <div className="h-96 flex items-center justify-center">
              <p className="font-body text-red-600">{error}</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-96 flex items-center justify-center">
              <p className="font-body text-charcoal/60">No projection data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97757" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#D97757" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DD" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#141413"
                  style={{ fontFamily: 'var(--font-body)' }}
                  interval="preserveStartEnd"
                  tickCount={Math.min(8, chartData.length)}
                />
                <YAxis
                  stroke="#141413"
                  style={{ fontFamily: 'var(--font-body)' }}
                  tickFormatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)}
                />
                <Tooltip
                  formatter={(value: number | undefined) => value !== undefined ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) : ''}
                  labelStyle={{ fontFamily: 'var(--font-body)' }}
                  contentStyle={{
                    backgroundColor: '#F0EFEA',
                    border: '1px solid #E6E4DD',
                    borderRadius: '8px',
                  }}
                />
                {chartData.some(point => point.value < 0) && (
                  <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                )}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#D97757"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Accounts Summary */}
        {loading && accounts.length === 0 && (
          <div className="space-y-6">
            <div className="h-7 bg-charcoal/8 rounded w-48 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm animate-pulse">
                  <div className="h-5 bg-charcoal/8 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-charcoal/6 rounded w-1/2 mb-6" />
                  <div className="h-7 bg-charcoal/8 rounded w-2/3" />
                </div>
              ))}
            </div>
          </div>
        )}
        {accounts.length > 0 && (
          <div className="space-y-6">
            {/* Checking/Savings */}
            {checkingSavings.length > 0 && (
              <div>
                <h2 className="font-heading text-2xl text-charcoal mb-4">Checking & Savings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {checkingSavings.map((account, index) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm relative"
                    >
                      <button
                        onClick={() => { setConfirmDeleteId(account.id); setDeleteError(null); }}
                        className="absolute top-4 right-4 text-charcoal/25 hover:text-red-500 transition-colors"
                        aria-label="Delete account"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                      <h3 className="font-body text-lg text-charcoal font-medium mb-2 pr-6">
                        {account.name}
                      </h3>
                      <p className="font-body text-sm text-charcoal/60 mb-4">
                        {account.subtype} {account.last_four ? `•••• ${account.last_four}` : ''}
                        {account.is_primary_payment && (
                          <span className="ml-2 text-terra">(Primary)</span>
                        )}
                      </p>
                      <p className="font-body text-2xl text-charcoal font-semibold">
                        {formatCurrency(account.latest_balance)}
                      </p>
                      {account.last_synced && (
                        <p className="font-body text-xs text-charcoal/40 mt-2">
                          Synced {formatTimeAgo(account.last_synced)}
                        </p>
                      )}
                      {confirmDeleteId === account.id && (
                        <div className="mt-4 pt-4 border-t border-border-subtle">
                          <p className="font-body text-sm text-charcoal mb-2">Remove this account?</p>
                          {deleteError && (
                            <p className="font-body text-xs text-red-600 mb-2">{deleteError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                              className="flex-1 px-3 py-1.5 border border-border-subtle rounded font-body text-sm text-charcoal hover:bg-cream transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded font-body text-sm hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Credit Cards */}
            {creditCards.length > 0 && (
              <div>
                <h2 className="font-heading text-2xl text-charcoal mb-4">Credit Cards</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {creditCards.map((account, index) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm relative"
                    >
                      <button
                        onClick={() => { setConfirmDeleteId(account.id); setDeleteError(null); }}
                        className="absolute top-4 right-4 text-charcoal/25 hover:text-red-500 transition-colors"
                        aria-label="Delete account"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                      <h3 className="font-body text-lg text-charcoal font-medium mb-2 pr-6">
                        {account.name}
                      </h3>
                      <p className="font-body text-sm text-charcoal/60 mb-2">
                        {account.subtype} {account.last_four ? `•••• ${account.last_four}` : ''}
                      </p>
                      {account.payment_day_of_month && (
                        <p className="font-body text-sm text-charcoal/60 mb-4">
                          Payment due day: {account.payment_day_of_month}
                        </p>
                      )}
                      <p className="font-body text-2xl text-charcoal font-semibold">
                        {formatCurrency(account.latest_balance)}
                      </p>
                      {account.last_synced && (
                        <p className="font-body text-xs text-charcoal/40 mt-2">
                          Synced {formatTimeAgo(account.last_synced)}
                        </p>
                      )}
                      {confirmDeleteId === account.id && (
                        <div className="mt-4 pt-4 border-t border-border-subtle">
                          <p className="font-body text-sm text-charcoal mb-2">Remove this account?</p>
                          {deleteError && (
                            <p className="font-body text-xs text-red-600 mb-2">{deleteError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                              className="flex-1 px-3 py-1.5 border border-border-subtle rounded font-body text-sm text-charcoal hover:bg-cream transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded font-body text-sm hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Retirement */}
            {retirement.length > 0 && (
              <div>
                <h2 className="font-heading text-2xl text-charcoal mb-4">Retirement</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {retirement.map((account, index) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm relative"
                    >
                      <button
                        onClick={() => { setConfirmDeleteId(account.id); setDeleteError(null); }}
                        className="absolute top-4 right-4 text-charcoal/25 hover:text-red-500 transition-colors"
                        aria-label="Delete account"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                      <h3 className="font-body text-lg text-charcoal font-medium mb-2 pr-6">
                        {account.name}
                      </h3>
                      <p className="font-body text-sm text-charcoal/60 mb-4">
                        {account.subtype} {account.last_four ? `•••• ${account.last_four}` : ''}
                      </p>
                      <p className="font-body text-2xl text-charcoal font-semibold">
                        {formatCurrency(account.latest_balance)}
                      </p>
                      {account.last_synced && (
                        <p className="font-body text-xs text-charcoal/40 mt-2">
                          Synced {formatTimeAgo(account.last_synced)}
                        </p>
                      )}
                      {confirmDeleteId === account.id && (
                        <div className="mt-4 pt-4 border-t border-border-subtle">
                          <p className="font-body text-sm text-charcoal mb-2">Remove this account?</p>
                          {deleteError && (
                            <p className="font-body text-xs text-red-600 mb-2">{deleteError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                              className="flex-1 px-3 py-1.5 border border-border-subtle rounded font-body text-sm text-charcoal hover:bg-cream transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded font-body text-sm hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rules Modal */}
        <AnimatePresence>
          {showRulesModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeRulesModal}
                className="fixed inset-0 bg-black/50 z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-heading text-2xl text-charcoal">
                      Add New Rule
                    </h2>
                    <Link
                      href="/rules"
                      className="text-sm font-body text-terra hover:underline"
                      onClick={closeRulesModal}
                    >
                      View All Rules
                    </Link>
                  </div>
                  {rulesModalError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 font-body text-sm">
                      {rulesModalError}
                    </div>
                  )}
                  <form onSubmit={handleRulesSubmit} className="space-y-4">
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={rulesFormData.name}
                        onChange={(e) => setRulesFormData({ ...rulesFormData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Amount
                        <span className="text-charcoal/50 ml-2">
                          (Use negative for expenses)
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={rulesFormData.amount}
                        onChange={(e) => setRulesFormData({ ...rulesFormData, amount: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Frequency
                      </label>
                      <select
                        value={rulesFormData.frequency}
                        onChange={(e) => setRulesFormData({ ...rulesFormData, frequency: e.target.value as any })}
                        required
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="once">Once</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={rulesFormData.anchor_date}
                        onChange={(e) => setRulesFormData({ ...rulesFormData, anchor_date: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={rulesFormData.end_date}
                        onChange={(e) => setRulesFormData({ ...rulesFormData, end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="active"
                        checked={rulesFormData.active}
                        onChange={(e) => setRulesFormData({ ...rulesFormData, active: e.target.checked })}
                        className="w-4 h-4 text-terra border-border-subtle rounded focus:ring-terra"
                      />
                      <label htmlFor="active" className="font-body text-sm text-charcoal">
                        Active
                      </label>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={closeRulesModal}
                        className="flex-1 px-4 py-2 border border-border-subtle rounded-lg font-body text-charcoal hover:bg-cream transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-terra text-white rounded-lg font-body hover:opacity-90 transition-opacity"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
