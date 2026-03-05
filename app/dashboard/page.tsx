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
  latest_available: number | null;
  last_polled_at: string | null;
}

interface Transaction {
  id: string;
  description: string;
  date: string;
  amount: string;
  status: string;
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
  const intentionalSignOut = useRef(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Record<string, Transaction[]>>({});
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{ date: string; netWorth: number; liquidNetWorth: number }[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
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

  async function fetchHistory() {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch {
      // Non-critical, don't show error
    }
  }

  async function fetchRules() {
    try {
      const res = await fetch('/api/rules');
      if (res.ok) {
        const data: RecurringRule[] = await res.json();
        setRecurringRules(data.filter((r) => r.active));
      }
    } catch {
      // Non-critical — CSV will just have empty rules column
    }
  }

  function ruleAppliesToDate(rule: RecurringRule, date: Date): boolean {
    const anchor = new Date(rule.anchor_date);
    anchor.setHours(0, 0, 0, 0);
    const endDate = rule.end_date ? new Date(rule.end_date) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);
    if (date < anchor) return false;
    if (endDate && date > endDate) return false;
    const daysDiff = Math.floor((date.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
    switch (rule.frequency) {
      case 'once': return daysDiff === 0;
      case 'weekly': return daysDiff % 7 === 0;
      case 'biweekly': return daysDiff % 14 === 0;
      case 'monthly': return date.getDate() === anchor.getDate();
      default: return false;
    }
  }

  function exportCSV() {
    if (!projection?.points.length) return;

    const today = new Date().toISOString().split('T')[0];
    const filename = `projection-${viewMode}-${timeFrame}d-${today}.csv`;

    const header = 'Date,Projected Balance,Rules Applied';
    const rows = projection.points.map((point) => {
      const date = new Date(point.date + 'T00:00:00');
      const triggered = recurringRules
        .filter((rule) => ruleAppliesToDate(rule, date))
        .map((rule) => rule.name)
        .join('; ');
      const escapedRules = triggered.includes(',') ? `"${triggered}"` : triggered;
      return `${point.date},${point.value},${escapedRules}`;
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

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

  async function toggleTransactions(accountId: string) {
    if (expandedAccount === accountId) {
      setExpandedAccount(null);
      return;
    }
    setExpandedAccount(accountId);
    if (transactions[accountId]) return;
    setTxLoading(accountId);
    setTxError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/transactions?count=20`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load transactions');
      }
      const data = await res.json();
      setTransactions((prev) => ({ ...prev, [accountId]: data }));
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setTxLoading(null);
    }
  }

  async function loadMoreTransactions(accountId: string) {
    const existing = transactions[accountId] || [];
    const lastId = existing[existing.length - 1]?.id;
    if (!lastId) return;
    setTxLoading(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}/transactions?count=20&from_id=${lastId}`);
      if (!res.ok) throw new Error('Failed to load more');
      const data = await res.json();
      setTransactions((prev) => ({
        ...prev,
        [accountId]: [...(prev[accountId] || []), ...data],
      }));
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setTxLoading(null);
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
    intentionalSignOut.current = true;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Detect expired or invalidated sessions client-side and redirect to login.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only treat SIGNED_OUT as "expired" when it was not triggered by the user clicking Sign Out.
      if (event === 'SIGNED_OUT' && !intentionalSignOut.current) {
        router.push('/login?expired=1');
      }
    });

    // Also guard: if there is no active session on mount, redirect immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login?expired=1');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  useEffect(() => {
    fetchAccounts();
    fetchHistory();
    fetchRules();
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

  function renderTransactionSection(accountId: string) {
    if (expandedAccount !== accountId) return null;
    const txs = transactions[accountId];
    const isLoading = txLoading === accountId;

    return (
      <div className="mt-4 pt-4 border-t border-border-subtle">
        {isLoading && !txs && (
          <p className="font-body text-sm text-charcoal/60 animate-pulse">Loading transactions...</p>
        )}
        {txError && expandedAccount === accountId && !txs && (
          <p className="font-body text-sm text-red-600">{txError}</p>
        )}
        {txs && txs.length === 0 && (
          <p className="font-body text-sm text-charcoal/60">No transactions found</p>
        )}
        {txs && txs.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {txs.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center py-1">
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-charcoal truncate">{tx.description}</p>
                  <div className="flex gap-2 items-center">
                    <span className="font-body text-xs text-charcoal/50">{tx.date}</span>
                    {tx.status === 'pending' && (
                      <span className="font-body text-xs text-yellow-600">Pending</span>
                    )}
                  </div>
                </div>
                <span className={`font-body text-sm font-medium ml-2 whitespace-nowrap ${
                  parseFloat(tx.amount) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(parseFloat(tx.amount))}
                </span>
              </div>
            ))}
            {txs.length >= 20 && (
              <button
                onClick={() => loadMoreTransactions(accountId)}
                disabled={isLoading}
                className="w-full py-2 text-sm font-body text-terra hover:underline disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl text-charcoal">Projection</h2>
            <button
              onClick={exportCSV}
              disabled={!projection?.points.length || loading}
              className="bg-white text-charcoal border border-border-subtle px-4 py-1.5 rounded-lg font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
          {loading ? (
            <div className="h-96 animate-pulse flex flex-col justify-end p-4 gap-2">
              <div className="flex items-end gap-1 h-full">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-charcoal/5 rounded-t"
                    style={{ height: `${30 + ((i * 37 + 13) % 60)}%` }}
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
            <>
            {/*
              Recharts does not support CSS variables in stroke/fill props — it reads
              values directly from the DOM attribute, not computed styles. The hex
              values below are intentional design token literals:
                #D97757 = terra (brand accent)
                #141413 = charcoal (text/axis)
                #E6E4DD = border-subtle (grid lines)
                #F0EFEA = cream (tooltip background)
            */}
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
            </>
          )}
        </div>

        {/* Historical Net Worth */}
        {historyData.length >= 2 && (
          <div className="bg-white border border-border-subtle rounded-lg p-6 mb-8 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-2xl text-charcoal">Net Worth History</h2>
              {(() => {
                const first = historyData[0];
                const last = historyData[historyData.length - 1];
                const change = last.netWorth - first.netWorth;
                return (
                  <span className={`font-body text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? '+' : ''}{formatCurrency(change)} since {format(parseISO(first.date), 'MMM d')}
                  </span>
                );
              })()}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={historyData.map(d => ({
                date: format(parseISO(d.date), 'MMM d'),
                netWorth: d.netWorth,
                liquidNetWorth: d.liquidNetWorth,
              }))} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#141413" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#141413" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6E4DD" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#141413"
                  style={{ fontFamily: 'var(--font-body)', fontSize: '12px' }}
                  interval={Math.max(0, Math.floor(historyData.length / 7) - 1)}
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
                  formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                  labelStyle={{ fontFamily: 'var(--font-body)' }}
                  contentStyle={{
                    backgroundColor: '#F0EFEA',
                    border: '1px solid #E6E4DD',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#141413"
                  strokeWidth={2}
                  fill="url(#colorHistory)"
                  name="Net Worth"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {historyData.length > 0 && historyData.length < 2 && (
          <div className="bg-white border border-border-subtle rounded-lg p-6 mb-8 shadow-sm text-center">
            <p className="font-body text-charcoal/60">Not enough history yet. Check back after more balance polls.</p>
          </div>
        )}

        {/* Accounts Skeleton */}
        {loading && accounts.length === 0 && (
          <div className="animate-pulse">
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
            >
              {['Checking & Savings', 'Credit Cards', 'Retirement'].map((label) => (
                <div key={label}>
                  <div className="h-5 bg-charcoal/10 rounded w-36 mb-1" />
                  <div className="h-4 bg-charcoal/10 rounded w-20 mb-4" />
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-white border border-border-subtle rounded-lg p-4">
                        <div className="h-4 bg-charcoal/10 rounded w-32 mb-2" />
                        <div className="h-3 bg-charcoal/10 rounded w-24 mb-3" />
                        <div className="h-7 bg-charcoal/10 rounded w-28" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accounts Summary */}
        {accounts.length > 0 && (
          (() => {
            const activeGroups = [
              { key: 'checkingSavings', label: 'Checking & Savings', accounts: checkingSavings },
              { key: 'creditCards', label: 'Credit Cards', accounts: creditCards },
              { key: 'retirement', label: 'Retirement', accounts: retirement },
            ].filter((g) => g.accounts.length > 0);

            return (
              <div
                className="grid gap-6 items-start"
                style={{ gridTemplateColumns: `repeat(${activeGroups.length}, minmax(0, 1fr))` }}
              >
                {activeGroups.map((group) => {
                  const groupTotal = group.accounts.reduce(
                    (sum, a) => sum + (a.latest_balance ?? 0),
                    0
                  );

                  return (
                    <div key={group.key} className="flex flex-col">
                      {/* Column header */}
                      <div className="mb-3">
                        <h2 className="font-heading text-lg text-charcoal">{group.label}</h2>
                        <p className="font-body text-sm text-charcoal/50">
                          {formatCurrency(groupTotal)}
                        </p>
                      </div>

                      {/* Cards */}
                      <div className="space-y-3">
                        {group.key === 'creditCards'
                          ? group.accounts.map((account, index) => (
                              <motion.div
                                key={account.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white border border-border-subtle rounded-lg p-4 shadow-sm"
                              >
                                {/* Name + remove */}
                                <div className="flex justify-between items-start mb-1">
                                  <h3 className="font-body text-sm text-charcoal font-medium leading-tight">
                                    {account.name}
                                  </h3>
                                  <button
                                    onClick={() => handleDisconnect(account.id)}
                                    disabled={disconnecting === account.id}
                                    className="text-xs font-body text-charcoal/30 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                                  >
                                    {disconnecting === account.id ? '...' : '×'}
                                  </button>
                                </div>

                                {/* Subtype + last four */}
                                <p className="font-body text-xs text-charcoal/50 mb-3">
                                  {account.subtype}
                                  {account.last_four ? ` •••• ${account.last_four}` : ''}
                                  {account.is_primary_payment && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-terra ml-2 align-middle" />
                                  )}
                                </p>

                                {/* Balance + utilization */}
                                {(() => {
                                  const ledger = account.latest_balance;
                                  const available = account.latest_available;
                                  if (available != null) {
                                    const creditLimit = ledger + available;
                                    const utilization = creditLimit > 0 ? ledger / creditLimit : 0;
                                    const pct = Math.round(utilization * 100);
                                    const barColor =
                                      pct < 30 ? '#22c55e' :
                                      pct < 50 ? '#eab308' :
                                      pct < 75 ? '#f97316' :
                                      '#ef4444';
                                    return (
                                      <>
                                        <p className="font-body text-2xl text-charcoal font-semibold">
                                          {formatCurrency(ledger)}
                                        </p>
                                        <p className="font-body text-xs text-charcoal/50 mt-0.5 mb-1.5">
                                          {formatCurrency(ledger)} / {formatCurrency(creditLimit)} ({pct}%)
                                        </p>
                                        <div className="w-full bg-border-subtle rounded-full h-1.5 mb-2">
                                          <div
                                            className="h-1.5 rounded-full transition-all"
                                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                                          />
                                        </div>
                                      </>
                                    );
                                  }
                                  return (
                                    <p className="font-body text-2xl text-charcoal font-semibold">
                                      {formatCurrency(ledger)}
                                    </p>
                                  );
                                })()}

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-2">
                                  {account.last_polled_at ? (
                                    <p className="font-body text-xs text-charcoal/35">
                                      Updated {formatDistanceToNow(parseISO(account.last_polled_at), { addSuffix: true })}
                                    </p>
                                  ) : <span />}
                                  <button
                                    onClick={() => toggleTransactions(account.id)}
                                    className="font-body text-xs text-terra hover:underline"
                                  >
                                    {expandedAccount === account.id ? 'Hide' : 'Transactions'}
                                  </button>
                                </div>
                                {renderTransactionSection(account.id)}
                              </motion.div>
                            ))
                          : group.accounts.map((account, index) => (
                              <motion.div
                                key={account.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white border border-border-subtle rounded-lg p-4 shadow-sm"
                              >
                                {/* Name + remove */}
                                <div className="flex justify-between items-start mb-1">
                                  <h3 className="font-body text-sm text-charcoal font-medium leading-tight">
                                    {account.name}
                                  </h3>
                                  <button
                                    onClick={() => handleDisconnect(account.id)}
                                    disabled={disconnecting === account.id}
                                    className="text-xs font-body text-charcoal/30 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                                  >
                                    {disconnecting === account.id ? '...' : '×'}
                                  </button>
                                </div>

                                {/* Subtype + last four + primary dot */}
                                <p className="font-body text-xs text-charcoal/50 mb-3">
                                  {account.subtype}
                                  {account.last_four ? ` •••• ${account.last_four}` : ''}
                                  {account.is_primary_payment && (
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-terra ml-2 align-middle" />
                                  )}
                                </p>

                                {/* Balance */}
                                <p className="font-body text-2xl text-charcoal font-semibold">
                                  {formatCurrency(account.latest_balance)}
                                </p>

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-2">
                                  {account.last_polled_at ? (
                                    <p className="font-body text-xs text-charcoal/35">
                                      Updated {formatDistanceToNow(parseISO(account.last_polled_at), { addSuffix: true })}
                                    </p>
                                  ) : <span />}
                                  <button
                                    onClick={() => toggleTransactions(account.id)}
                                    className="font-body text-xs text-terra hover:underline"
                                  >
                                    {expandedAccount === account.id ? 'Hide' : 'Transactions'}
                                  </button>
                                </div>
                                {renderTransactionSection(account.id)}
                              </motion.div>
                            ))
                        }
                      </div>

                      {/* Column total */}
                      <p className="font-body text-xs text-charcoal/40 mt-3 pt-3 border-t border-border-subtle">
                        Total: {formatCurrency(groupTotal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })()
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
                        onChange={(e) => setRulesFormData({ ...rulesFormData, frequency: e.target.value as RecurringRule['frequency'] })}
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
