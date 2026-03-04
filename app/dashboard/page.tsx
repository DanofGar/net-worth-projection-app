'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/app/components/Toast';

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
  last_polled_at: string | null;
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
  const supabase = useMemo(() => createBrowserClient(), []);
  const [viewMode, setViewMode] = useState<ViewMode>('cash_flow');
  const [scope, setScope] = useState<Scope>('total');
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<number>(15);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);
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

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const response = await fetch('/api/accounts/refresh', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to refresh balances');
      }
      toast('success', 'Balances refreshed');
      await fetchAccounts();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm('Remove this account? This cannot be undone.')) return;
    setDisconnecting(accountId);
    try {
      const response = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove account');
      toast('success', 'Account removed');
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to remove account');
    } finally {
      setDisconnecting(null);
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const accountsLoaded = useRef(false);
  useEffect(() => {
    if (accounts.length > 0) {
      accountsLoaded.current = true;
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
      const msg = err instanceof Error ? err.message : 'Failed to load projection';
      toast('error', msg);
      setError(msg);
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
      if (data.length === 0) {
        setLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load accounts';
      toast('error', msg);
      setError(msg);
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

    setRuleSubmitting(true);
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

      toast('success', 'Rule created');
      closeRulesModal();
      if (accounts.length > 0) {
        await fetchProjection();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save rule';
      toast('error', msg);
      setRulesModalError(msg);
    } finally {
      setRuleSubmitting(false);
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
      <div className="min-h-screen bg-cream p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="font-heading text-5xl text-charcoal">
              Financial Projections
            </h1>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="bg-white text-charcoal border border-border-subtle px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {signingOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>

          <div className="bg-white border border-border-subtle rounded-lg p-12 text-center">
            <h2 className="font-heading text-2xl text-charcoal mb-4">
              Connect Your First Account
            </h2>
            <p className="font-body text-charcoal/60 mb-8">
              Get started by connecting your bank account to see 60-day financial projections.
            </p>
            <a
              href="/connect"
              className="inline-block bg-terra text-white px-8 py-3 rounded-lg font-body hover:opacity-90 transition-opacity"
            >
              Connect Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-heading text-5xl text-charcoal">
            Financial Projections
          </h1>
          <div className="flex gap-3">
            <Link
              href="/rules"
              className="bg-white text-charcoal border border-border-subtle px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity"
            >
              Manage Rules
            </Link>
            <button
              onClick={openRulesModal}
              className="bg-white text-charcoal border border-border-subtle px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity"
            >
              Quick Add Rule
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white text-charcoal border border-border-subtle px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Balances'}
            </button>
            <a
              href="/connect"
              className="bg-terra text-white px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity"
            >
              + Add Account
            </a>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="bg-white text-charcoal border border-border-subtle px-6 py-2 rounded-lg font-body hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {signingOut ? 'Signing Out...' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="mb-8 space-y-4">
          <div className="flex gap-4">
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
          </div>

          {viewMode === 'net_worth' && (
            <div className="flex gap-4">
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

          {/* Timeframe controls — visible in both modes */}
          <div className="flex gap-3">
            {[15, 30, 45, 60].map((days) => (
              <button
                key={days}
                onClick={() => setTimeFrame(days)}
                className={`px-4 py-2 rounded-lg font-body text-sm transition-colors ${
                  timeFrame === days
                    ? 'bg-terra text-white'
                    : 'bg-white text-charcoal border border-border-subtle hover:opacity-90'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Current Value Card */}
        {loading && !projection ? (
          <div className="bg-white border border-border-subtle rounded-lg p-6 mb-8 shadow-sm max-w-md animate-pulse">
            <div className="h-5 bg-charcoal/10 rounded w-48 mb-3" />
            <div className="h-10 bg-charcoal/10 rounded w-36" />
          </div>
        ) : projection ? (
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
            </div>
          </div>
        ) : null}

        {/* Projection Chart */}
        <div className="bg-white border border-border-subtle rounded-lg p-6 mb-8 shadow-sm">
          {loading ? (
            <div className="h-96 animate-pulse flex flex-col justify-end p-4 gap-2">
              <div className="flex items-end gap-1 h-full">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-charcoal/5 rounded-t"
                    style={{ height: `${30 + Math.random() * 60}%` }}
                  />
                ))}
              </div>
              <div className="h-4 bg-charcoal/10 rounded w-full" />
            </div>
          ) : error ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4">
              <div className="text-center">
                <p className="font-body text-lg text-charcoal mb-1">Something went wrong</p>
                <p className="font-body text-sm text-charcoal/60">{error}</p>
              </div>
              <button
                onClick={() => { fetchAccounts(); }}
                className="px-6 py-2 bg-terra text-white rounded-lg font-body hover:opacity-90 transition-opacity"
              >
                Retry
              </button>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-96 flex items-center justify-center">
              <p className="font-body text-charcoal/60">No projection data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
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
                  style={{ fontFamily: 'var(--font-body)', fontSize: '12px' }}
                  interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
                  tickMargin={8}
                />
                <YAxis
                  stroke="#141413"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '12px' }}
                  width={70}
                  tickFormatter={(value: number) => {
                    const abs = Math.abs(value);
                    const sign = value < 0 ? '-' : '';
                    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
                    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
                    return `${sign}$${abs}`;
                  }}
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

        {/* Accounts Skeleton */}
        {loading && accounts.length === 0 && (
          <div className="space-y-6 animate-pulse">
            <div>
              <div className="h-7 bg-charcoal/10 rounded w-48 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-border-subtle rounded-lg p-6">
                    <div className="h-5 bg-charcoal/10 rounded w-32 mb-3" />
                    <div className="h-4 bg-charcoal/10 rounded w-24 mb-4" />
                    <div className="h-8 bg-charcoal/10 rounded w-28" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Accounts Summary */}
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
                      className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-body text-lg text-charcoal font-medium">
                          {account.name}
                        </h3>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnecting === account.id}
                          className="text-xs font-body text-charcoal/40 hover:text-red-600 transition-colors"
                        >
                          {disconnecting === account.id ? '...' : 'Remove'}
                        </button>
                      </div>
                      <p className="font-body text-sm text-charcoal/60 mb-4">
                        {account.subtype} {account.last_four ? `•••• ${account.last_four}` : ''}
                        {account.is_primary_payment && (
                          <span className="ml-2 text-terra">(Primary)</span>
                        )}
                      </p>
                      <p className="font-body text-2xl text-charcoal font-semibold">
                        {formatCurrency(account.latest_balance)}
                      </p>
                      {account.last_polled_at && (
                        <p className="font-body text-xs text-charcoal/40 mt-2">
                          Updated {formatDistanceToNow(parseISO(account.last_polled_at), { addSuffix: true })}
                        </p>
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
                      className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-body text-lg text-charcoal font-medium">
                          {account.name}
                        </h3>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnecting === account.id}
                          className="text-xs font-body text-charcoal/40 hover:text-red-600 transition-colors"
                        >
                          {disconnecting === account.id ? '...' : 'Remove'}
                        </button>
                      </div>
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
                      {account.last_polled_at && (
                        <p className="font-body text-xs text-charcoal/40 mt-2">
                          Updated {formatDistanceToNow(parseISO(account.last_polled_at), { addSuffix: true })}
                        </p>
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
                      className="bg-white border border-border-subtle rounded-lg p-6 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-body text-lg text-charcoal font-medium">
                          {account.name}
                        </h3>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnecting === account.id}
                          className="text-xs font-body text-charcoal/40 hover:text-red-600 transition-colors"
                        >
                          {disconnecting === account.id ? '...' : 'Remove'}
                        </button>
                      </div>
                      <p className="font-body text-sm text-charcoal/60 mb-4">
                        {account.subtype} {account.last_four ? `•••• ${account.last_four}` : ''}
                      </p>
                      <p className="font-body text-2xl text-charcoal font-semibold">
                        {formatCurrency(account.latest_balance)}
                      </p>
                      {account.last_polled_at && (
                        <p className="font-body text-xs text-charcoal/40 mt-2">
                          Updated {formatDistanceToNow(parseISO(account.last_polled_at), { addSuffix: true })}
                        </p>
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
                      <div
                        className="cursor-pointer"
                        onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker()}
                      >
                        <input
                          type="date"
                          value={rulesFormData.anchor_date}
                          onChange={(e) => setRulesFormData({ ...rulesFormData, anchor_date: e.target.value })}
                          required
                          className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra cursor-pointer"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-body text-sm text-charcoal mb-1">
                        End Date (Optional)
                      </label>
                      <div
                        className="cursor-pointer"
                        onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.showPicker()}
                      >
                        <input
                          type="date"
                          value={rulesFormData.end_date}
                          onChange={(e) => setRulesFormData({ ...rulesFormData, end_date: e.target.value })}
                          className="w-full px-3 py-2 border border-border-subtle rounded-lg font-body focus:outline-none focus:ring-2 focus:ring-terra cursor-pointer"
                        />
                      </div>
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
                        disabled={ruleSubmitting}
                        className="flex-1 px-4 py-2 bg-terra text-white rounded-lg font-body hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {ruleSubmitting ? 'Creating...' : 'Create'}
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
