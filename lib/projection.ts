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

interface AccountWithBalance {
  id: string;
  type: 'depository' | 'credit';
  subtype: string;
  is_liquid: boolean;
  is_primary_payment: boolean;
  payment_day_of_month: number | null;
  latest_balance: number;
}

interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'once';
  anchor_date: string;
  end_date: string | null;
  active: boolean;
}

export async function generateProjection(
  userId: string,
  days: number = 60,
  viewMode: ViewMode = 'net_worth',
  scope: Scope = 'total'
): Promise<ProjectionResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch enrollments for this user first
  const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('user_id', userId);

  if (enrollmentsError) {
    throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
  }

  const enrollmentIds = (enrollments || []).map(e => e.id);

  if (enrollmentIds.length === 0) {
    // No enrollments, return empty projection
    return {
      points: [],
      startingValue: 0,
      metadata: {
        viewMode,
        scope,
        accountsIncluded: 0,
        rulesApplied: 0,
      },
    };
  }

  // Fetch accounts with their latest balances (optimized query)
  const { data: accountsRaw, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, type, subtype, is_liquid, is_primary_payment, payment_day_of_month, enrollment_id')
    .in('enrollment_id', enrollmentIds);

  if (accountsError) {
    throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
  }

  // Fetch latest balance for each account (batch query)
  const accountIds = (accountsRaw || []).map(a => a.id);
  
  const { data: balancesData, error: balancesError } = await supabaseAdmin
    .from('balances')
    .select('account_id, ledger, polled_at')
    .in('account_id', accountIds)
    .order('polled_at', { ascending: false });

  if (balancesError) {
    throw new Error(`Failed to fetch balances: ${balancesError.message}`);
  }

  // Group balances by account_id and get latest for each
  const latestBalances = new Map<string, number>();
  const seenAccounts = new Set<string>();
  for (const balance of balancesData || []) {
    if (!seenAccounts.has(balance.account_id)) {
      latestBalances.set(balance.account_id, parseFloat(balance.ledger.toString()));
      seenAccounts.add(balance.account_id);
    }
  }

  // Transform to usable format with latest balance
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

  // Calculate starting value based on view mode
  let startingValue = 0;
  let primaryAccountBalance = 0;
  const creditCards: { balance: number; dueDay: number }[] = [];
  let accountsIncluded = 0;

  for (const account of accounts) {
    // Find primary account balance
    if (account.is_primary_payment) {
      primaryAccountBalance = account.latest_balance;
    }

    // Collect credit card info for autopay
    if (account.subtype === 'credit_card' && account.payment_day_of_month) {
      creditCards.push({
        balance: account.latest_balance,
        dueDay: account.payment_day_of_month,
      });
    }

    // Calculate net worth starting value
    if (viewMode === 'net_worth') {
      // Skip non-liquid accounts if scope is 'liquid'
      if (scope === 'liquid' && !account.is_liquid) {
        continue;
      }

      accountsIncluded++;

      if (account.type === 'depository') {
        startingValue += account.latest_balance;
      } else if (account.type === 'credit') {
        // Credit balances are liabilities (subtract)
        startingValue -= account.latest_balance;
      }
    }
  }

  // For cash flow mode, start with primary account balance
  if (viewMode === 'cash_flow') {
    startingValue = primaryAccountBalance;
    accountsIncluded = 1;
  }

  // Generate projection points
  const points: ProjectionPoint[] = [];
  let runningValue = startingValue;

  for (let d = 0; d <= days; d++) {
    const date = addDays(today, d);

    // Apply recurring rules (skip day 0 to avoid double-counting)
    if (d > 0) {
      for (const rule of rules || []) {
        if (ruleAppliesToDate(rule, date)) {
          runningValue += rule.amount;
        }
      }
    }

    // Apply CC autopay (cash_flow mode only, skip day 0)
    if (viewMode === 'cash_flow' && d > 0) {
      const dayOfMonth = getDate(date);
      for (const cc of creditCards) {
        if (cc.dueDay === dayOfMonth) {
          runningValue -= cc.balance;
        }
      }
    }

    points.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(runningValue * 100) / 100, // Round to cents
    });
  }

  return {
    points,
    startingValue,
    metadata: {
      viewMode,
      scope,
      accountsIncluded,
      rulesApplied: rules?.length || 0,
    },
  };
}

function ruleAppliesToDate(rule: RecurringRule, date: Date): boolean {
  const anchor = new Date(rule.anchor_date);
  anchor.setHours(0, 0, 0, 0);
  
  const endDate = rule.end_date ? new Date(rule.end_date) : null;
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  // Check bounds
  if (date < anchor) return false;
  if (endDate && date > endDate) return false;

  const daysDiff = Math.floor(
    (date.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24)
  );

  switch (rule.frequency) {
    case 'once':
      return isSameDay(date, anchor);
    case 'weekly':
      return daysDiff % 7 === 0;
    case 'biweekly':
      return daysDiff % 14 === 0;
    case 'monthly': {
      const anchorDay = getDate(anchor);
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const effectiveDay = Math.min(anchorDay, daysInMonth);
      return getDate(date) === effectiveDay;
    }
    default:
      return false;
  }
}
