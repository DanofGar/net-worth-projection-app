import { supabaseAdmin } from './supabase';
import { addDays, isSameDay, getDate } from 'date-fns';

export type ViewMode = 'net_worth' | 'cash_flow';
export type Scope = 'total' | 'liquid';

export interface ProjectionPoint {
  date: string; // ISO date string
  value: number;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  startingValue: number;
  metadata: {
    viewMode: ViewMode;
    scope: Scope;
    accountsIncluded: number;
    rulesApplied: number;
  };
}

export interface AccountWithBalance {
  id: string;
  type: 'depository' | 'credit';
  subtype: string;
  is_liquid: boolean;
  is_primary_payment: boolean;
  payment_day_of_month: number | null;
  latest_balance: number;
}

export interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'once';
  anchor_date: string;
  end_date: string | null;
  active: boolean;
}

export interface CalculateProjectionInput {
  accounts: AccountWithBalance[];
  rules: RecurringRule[];
  days: number;
  viewMode: ViewMode;
  scope: Scope;
  today?: Date;
}

/**
 * Pure projection calculation — no DB calls.
 * Takes pre-fetched data and returns the projection result.
 */
export function calculateProjection(input: CalculateProjectionInput): ProjectionResult {
  const { accounts, rules, days, viewMode, scope } = input;
  // Normalize to UTC midnight so date arithmetic is timezone-consistent.
  // Using UTC prevents getUTCDate() from drifting when the input is a UTC
  // midnight timestamp and the host machine is behind UTC.
  const rawToday = input.today ?? new Date();
  const today = new Date(Date.UTC(
    rawToday.getUTCFullYear(),
    rawToday.getUTCMonth(),
    rawToday.getUTCDate()
  ));

  let startingValue = 0;
  let primaryAccountBalance = 0;
  const creditCards: { balance: number; dueDay: number }[] = [];
  let accountsIncluded = 0;

  for (const account of accounts) {
    if (account.is_primary_payment) {
      primaryAccountBalance = account.latest_balance;
    }

    if (account.subtype === 'credit_card' && account.payment_day_of_month) {
      creditCards.push({
        balance: account.latest_balance,
        dueDay: account.payment_day_of_month,
      });
    }

    if (viewMode === 'net_worth') {
      if (scope === 'liquid' && !account.is_liquid) {
        continue;
      }

      accountsIncluded++;

      if (account.type === 'depository') {
        startingValue += account.latest_balance;
      } else if (account.type === 'credit') {
        startingValue -= account.latest_balance;
      }
    }
  }

  if (viewMode === 'cash_flow') {
    startingValue = primaryAccountBalance;
    accountsIncluded = 1;
  }

  const points: ProjectionPoint[] = [];
  let runningValue = startingValue;

  for (let d = 0; d <= days; d++) {
    const date = addDays(today, d);

    if (d > 0) {
      for (const rule of rules) {
        if (ruleAppliesToDate(rule, date)) {
          runningValue += rule.amount;
        }
      }
    }

    if (viewMode === 'cash_flow' && d > 0) {
      const dayOfMonth = date.getUTCDate();
      for (const cc of creditCards) {
        if (cc.dueDay === dayOfMonth) {
          runningValue -= cc.balance;
        }
      }
    }

    points.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(runningValue * 100) / 100,
    });
  }

  return {
    points,
    startingValue,
    metadata: {
      viewMode,
      scope,
      accountsIncluded,
      rulesApplied: rules.length,
    },
  };
}

/**
 * Thin wrapper: fetches data from DB, then delegates to calculateProjection.
 */
export async function generateProjection(
  userId: string,
  days: number = 60,
  viewMode: ViewMode = 'net_worth',
  scope: Scope = 'total'
): Promise<ProjectionResult> {
  // Fetch enrollments for this user
  const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('user_id', userId);

  if (enrollmentsError) {
    throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
  }

  const enrollmentIds = (enrollments || []).map(e => e.id);

  if (enrollmentIds.length === 0) {
    return calculateProjection({ accounts: [], rules: [], days, viewMode, scope });
  }

  // Fetch accounts
  const { data: accountsRaw, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, type, subtype, is_liquid, is_primary_payment, payment_day_of_month, enrollment_id')
    .in('enrollment_id', enrollmentIds);

  if (accountsError) {
    throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
  }

  // Batch fetch latest balance per account (bounded: 1 per account via dedup)
  const accountIds = (accountsRaw || []).map(a => a.id);

  const { data: balancesData, error: balancesError } = await supabaseAdmin
    .from('balances')
    .select('account_id, ledger, polled_at')
    .in('account_id', accountIds)
    .order('polled_at', { ascending: false })
    .limit(accountIds.length * 5);

  if (balancesError) {
    throw new Error(`Failed to fetch balances: ${balancesError.message}`);
  }

  const latestBalances = new Map<string, number>();
  for (const balance of balancesData || []) {
    if (!latestBalances.has(balance.account_id)) {
      latestBalances.set(balance.account_id, parseFloat(balance.ledger.toString()));
    }
  }

  const accounts: AccountWithBalance[] = (accountsRaw || []).map((acc) => ({
    id: acc.id,
    type: acc.type,
    subtype: acc.subtype,
    is_liquid: acc.is_liquid,
    is_primary_payment: acc.is_primary_payment,
    payment_day_of_month: acc.payment_day_of_month,
    latest_balance: latestBalances.get(acc.id) ?? 0,
  }));

  // Fetch active recurring rules
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('recurring_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);

  if (rulesError) {
    throw new Error(`Failed to fetch rules: ${rulesError.message}`);
  }

  return calculateProjection({
    accounts,
    rules: rules || [],
    days,
    viewMode,
    scope,
  });
}

export function ruleAppliesToDate(rule: RecurringRule, date: Date): boolean {
  // Normalize both anchor and date to UTC midnight so timezone-varying inputs
  // (local-time strings like '2025-01-15T00:00:00' vs UTC '2025-01-15Z') all
  // resolve to the same UTC calendar day before comparison.
  const rawAnchor = new Date(rule.anchor_date);
  const anchor = new Date(Date.UTC(
    rawAnchor.getUTCFullYear(),
    rawAnchor.getUTCMonth(),
    rawAnchor.getUTCDate()
  ));

  const dateUTC = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));

  let endDate: Date | null = null;
  if (rule.end_date) {
    const rawEnd = new Date(rule.end_date);
    endDate = new Date(Date.UTC(rawEnd.getUTCFullYear(), rawEnd.getUTCMonth(), rawEnd.getUTCDate()));
  }

  if (dateUTC < anchor) return false;
  if (endDate && dateUTC > endDate) return false;

  const daysDiff = Math.round(
    (dateUTC.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24)
  );

  switch (rule.frequency) {
    case 'once':
      return daysDiff === 0;
    case 'weekly':
      return daysDiff % 7 === 0;
    case 'biweekly':
      return daysDiff % 14 === 0;
    case 'monthly':
      return dateUTC.getUTCDate() === anchor.getUTCDate();
    default:
      return false;
  }
}
