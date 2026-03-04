import { describe, it, expect, vi } from 'vitest';

// Mock the supabase module before importing projection.ts so the env-var
// guard in supabase.ts does not throw during test collection.
vi.mock('../supabase', () => ({
  supabaseAdmin: {},
  supabase: {},
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(),
}));

import {
  calculateProjection,
  ruleAppliesToDate,
  AccountWithBalance,
  RecurringRule,
  CalculateProjectionInput,
} from '../projection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccount(overrides: Partial<AccountWithBalance> = {}): AccountWithBalance {
  return {
    id: 'acc-1',
    type: 'depository',
    subtype: 'checking',
    is_liquid: true,
    is_primary_payment: false,
    payment_day_of_month: null,
    latest_balance: 1000,
    ...overrides,
  };
}

function makeRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    amount: 100,
    frequency: 'monthly',
    anchor_date: '2025-01-15',
    end_date: null,
    active: true,
    ...overrides,
  };
}

// A fixed "today" so tests are deterministic regardless of when they run.
// Using local-time construction to avoid timezone-offset issues with getDate().
// Jan 15 2025 is a Wednesday — good anchor for weekly/biweekly math.
const TODAY = new Date(2025, 0, 15); // month is 0-indexed

// ---------------------------------------------------------------------------
// calculateProjection — basic known-input tests
// ---------------------------------------------------------------------------

describe('calculateProjection', () => {
  describe('known inputs — checking + credit accounts, weekly/monthly rules', () => {
    it('produces the correct number of points (days + 1)', () => {
      const input: CalculateProjectionInput = {
        accounts: [makeAccount({ latest_balance: 5000 })],
        rules: [],
        days: 5,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      };
      const result = calculateProjection(input);
      expect(result.points).toHaveLength(6); // day 0 through day 5
    });

    it('net_worth: checking adds, credit subtracts, startingValue is correct', () => {
      const checking = makeAccount({
        id: 'chk-1',
        type: 'depository',
        subtype: 'checking',
        latest_balance: 3000,
      });
      const credit = makeAccount({
        id: 'cc-1',
        type: 'credit',
        subtype: 'credit_card',
        latest_balance: 500,
        payment_day_of_month: 20,
      });
      const input: CalculateProjectionInput = {
        accounts: [checking, credit],
        rules: [],
        days: 3,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      };
      const result = calculateProjection(input);
      // 3000 - 500 = 2500
      expect(result.startingValue).toBe(2500);
      expect(result.points[0].value).toBe(2500);
      // No rules — every point should stay at 2500
      for (const p of result.points) {
        expect(p.value).toBe(2500);
      }
      expect(result.metadata.accountsIncluded).toBe(2);
    });

    it('weekly rule fires every 7 days starting from anchor', () => {
      // Use local-time anchor so daysDiff aligns with local-midnight TODAY.
      // '2025-01-15T00:00:00' (no Z) is parsed as local time in JavaScript.
      const rule = makeRule({
        frequency: 'weekly',
        amount: 200,
        anchor_date: '2025-01-15T00:00:00',
      });
      const input: CalculateProjectionInput = {
        accounts: [makeAccount({ latest_balance: 1000 })],
        rules: [rule],
        days: 14,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      };
      const result = calculateProjection(input);

      // Day 0: 1000 (no rules on day 0)
      expect(result.points[0].value).toBe(1000);
      // Day 1–6: 1000 (rule not yet due)
      for (let d = 1; d <= 6; d++) {
        expect(result.points[d].value).toBe(1000);
      }
      // Day 7: rule fires → 1200
      expect(result.points[7].value).toBe(1200);
      // Day 8–13: 1200
      for (let d = 8; d <= 13; d++) {
        expect(result.points[d].value).toBe(1200);
      }
      // Day 14: rule fires again → 1400
      expect(result.points[14].value).toBe(1400);
    });

    it('monthly rule fires on the same day each month', () => {
      // TODAY = Jan 15. Rule anchor on Jan 15 (local time).
      // Day 0 = Jan 15, day 31 = Feb 15 (the next monthly firing).
      const rule = makeRule({
        frequency: 'monthly',
        amount: 500,
        anchor_date: '2025-01-15T00:00:00',
      });
      const input: CalculateProjectionInput = {
        accounts: [makeAccount({ latest_balance: 2000 })],
        rules: [rule],
        days: 32,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      };
      const result = calculateProjection(input);

      // Day 0 (Jan 15): no rule on day 0
      expect(result.points[0].value).toBe(2000);
      // Days 1–30 (Jan 16 – Feb 14): no fire
      for (let d = 1; d <= 30; d++) {
        expect(result.points[d].value).toBe(2000);
      }
      // Day 31 (Feb 15): fires → 2500
      expect(result.points[31].value).toBe(2500);
      // Day 32 (Feb 16): no fire → still 2500
      expect(result.points[32].value).toBe(2500);
    });

    it('metadata reflects correct rulesApplied count', () => {
      const rules = [makeRule({ id: 'r1' }), makeRule({ id: 'r2' })];
      const result = calculateProjection({
        accounts: [makeAccount()],
        rules,
        days: 5,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.metadata.rulesApplied).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Zero accounts
  // -------------------------------------------------------------------------

  describe('zero accounts', () => {
    it('returns startingValue of 0', () => {
      const result = calculateProjection({
        accounts: [],
        rules: [],
        days: 5,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.startingValue).toBe(0);
    });

    it('all points have value 0 when no accounts and no rules', () => {
      const result = calculateProjection({
        accounts: [],
        rules: [],
        days: 5,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      for (const p of result.points) {
        expect(p.value).toBe(0);
      }
    });

    it('accountsIncluded is 0', () => {
      const result = calculateProjection({
        accounts: [],
        rules: [],
        days: 3,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.metadata.accountsIncluded).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Zero rules — flat line
  // -------------------------------------------------------------------------

  describe('zero rules', () => {
    it('balance stays constant across all points', () => {
      const result = calculateProjection({
        accounts: [makeAccount({ latest_balance: 4200 })],
        rules: [],
        days: 10,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      for (const p of result.points) {
        expect(p.value).toBe(4200);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Negative starting balance
  // -------------------------------------------------------------------------

  describe('negative starting balance', () => {
    it('handles correctly when only credit card accounts are present', () => {
      // In net_worth mode: credit subtracts → startingValue is negative
      const cc = makeAccount({
        id: 'cc-only',
        type: 'credit',
        subtype: 'credit_card',
        latest_balance: 800,
        payment_day_of_month: 10,
      });
      const result = calculateProjection({
        accounts: [cc],
        rules: [],
        days: 3,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.startingValue).toBe(-800);
      for (const p of result.points) {
        expect(p.value).toBe(-800);
      }
    });

    it('rule with negative amount drives balance lower from an already negative start', () => {
      const cc = makeAccount({
        id: 'cc-neg',
        type: 'credit',
        subtype: 'credit_card',
        latest_balance: 500,
        payment_day_of_month: null,
      });
      // weekly expense rule, anchor = TODAY (local) so fires on day 7
      const rule = makeRule({
        frequency: 'weekly',
        amount: -100,
        anchor_date: '2025-01-15T00:00:00',
      });
      const result = calculateProjection({
        accounts: [cc],
        rules: [rule],
        days: 7,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.points[0].value).toBe(-500);
      expect(result.points[7].value).toBe(-600);
    });
  });

  // -------------------------------------------------------------------------
  // CC autopay deduction
  // -------------------------------------------------------------------------

  describe('CC autopay deduction in cash_flow mode', () => {
    it('deducts CC balance on the correct day of month', () => {
      // TODAY = Jan 15. CC dueDay = 20 → fires on Jan 20 = day 5.
      const primary = makeAccount({
        id: 'primary',
        type: 'depository',
        subtype: 'checking',
        is_primary_payment: true,
        latest_balance: 3000,
      });
      const cc = makeAccount({
        id: 'cc-due',
        type: 'credit',
        subtype: 'credit_card',
        is_liquid: false,
        payment_day_of_month: 20,
        latest_balance: 400,
      });
      const result = calculateProjection({
        accounts: [primary, cc],
        rules: [],
        days: 7,
        viewMode: 'cash_flow',
        scope: 'total',
        today: new Date(TODAY),
      });

      // startingValue = primary balance
      expect(result.startingValue).toBe(3000);
      // Days 0–4: 3000
      for (let d = 0; d <= 4; d++) {
        expect(result.points[d].value).toBe(3000);
      }
      // Day 5 (Jan 20): CC autopay deducts 400 → 2600
      expect(result.points[5].value).toBe(2600);
      // Days 6–7: stays at 2600
      for (let d = 6; d <= 7; d++) {
        expect(result.points[d].value).toBe(2600);
      }
    });

    it('autopay does NOT fire on day 0 even if dueDay matches today', () => {
      // TODAY = Jan 15, dueDay = 15 → day 0 matches but rules/autopay skip day 0
      const primary = makeAccount({
        id: 'primary-day0',
        type: 'depository',
        subtype: 'checking',
        is_primary_payment: true,
        latest_balance: 2000,
      });
      const cc = makeAccount({
        id: 'cc-day0',
        type: 'credit',
        subtype: 'credit_card',
        payment_day_of_month: 15,
        latest_balance: 300,
      });
      const result = calculateProjection({
        accounts: [primary, cc],
        rules: [],
        days: 3,
        viewMode: 'cash_flow',
        scope: 'total',
        today: new Date(TODAY),
      });
      // Day 0: no autopay → 2000
      expect(result.points[0].value).toBe(2000);
      // Next occurrence of day 15 is Feb 15 = day 31, out of range
      for (let d = 1; d <= 3; d++) {
        expect(result.points[d].value).toBe(2000);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Scope: liquid vs total
  // -------------------------------------------------------------------------

  describe('scope filtering', () => {
    const checking = makeAccount({
      id: 'chk',
      type: 'depository',
      subtype: 'checking',
      is_liquid: true,
      latest_balance: 2000,
    });
    const savings = makeAccount({
      id: 'sav',
      type: 'depository',
      subtype: 'savings',
      is_liquid: false,
      latest_balance: 10000,
    });

    it('liquid scope only includes liquid accounts', () => {
      const result = calculateProjection({
        accounts: [checking, savings],
        rules: [],
        days: 0,
        viewMode: 'net_worth',
        scope: 'liquid',
        today: new Date(TODAY),
      });
      expect(result.startingValue).toBe(2000);
      expect(result.metadata.accountsIncluded).toBe(1);
    });

    it('total scope includes all accounts', () => {
      const result = calculateProjection({
        accounts: [checking, savings],
        rules: [],
        days: 0,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.startingValue).toBe(12000);
      expect(result.metadata.accountsIncluded).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // net_worth vs cash_flow mode differences
  // -------------------------------------------------------------------------

  describe('net_worth vs cash_flow mode', () => {
    const primary = makeAccount({
      id: 'primary-mode',
      type: 'depository',
      subtype: 'checking',
      is_primary_payment: true,
      latest_balance: 1500,
    });
    const savings = makeAccount({
      id: 'sav-mode',
      type: 'depository',
      subtype: 'savings',
      is_liquid: true,
      latest_balance: 5000,
    });

    it('net_worth startingValue sums all accounts', () => {
      const result = calculateProjection({
        accounts: [primary, savings],
        rules: [],
        days: 0,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.startingValue).toBe(6500);
      expect(result.metadata.accountsIncluded).toBe(2);
    });

    it('cash_flow startingValue uses only primary account', () => {
      const result = calculateProjection({
        accounts: [primary, savings],
        rules: [],
        days: 0,
        viewMode: 'cash_flow',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.startingValue).toBe(1500);
      expect(result.metadata.accountsIncluded).toBe(1);
    });

    it('cash_flow mode metadata reflects viewMode correctly', () => {
      const result = calculateProjection({
        accounts: [primary],
        rules: [],
        days: 0,
        viewMode: 'cash_flow',
        scope: 'total',
        today: new Date(TODAY),
      });
      expect(result.metadata.viewMode).toBe('cash_flow');
    });

    it('net_worth mode applies rules to combined balance', () => {
      const rule = makeRule({
        frequency: 'weekly',
        amount: 300,
        anchor_date: '2025-01-15T00:00:00',
      });
      const nw = calculateProjection({
        accounts: [primary, savings],
        rules: [rule],
        days: 7,
        viewMode: 'net_worth',
        scope: 'total',
        today: new Date(TODAY),
      });
      // Day 7: 6500 + 300 = 6800
      expect(nw.points[7].value).toBe(6800);
    });

    it('cash_flow mode applies rules to primary-account balance only', () => {
      const rule = makeRule({
        frequency: 'weekly',
        amount: 300,
        anchor_date: '2025-01-15T00:00:00',
      });
      const cf = calculateProjection({
        accounts: [primary, savings],
        rules: [rule],
        days: 7,
        viewMode: 'cash_flow',
        scope: 'total',
        today: new Date(TODAY),
      });
      // Day 7: 1500 + 300 = 1800
      expect(cf.points[7].value).toBe(1800);
    });
  });
});

// ---------------------------------------------------------------------------
// ruleAppliesToDate
// ---------------------------------------------------------------------------

describe('ruleAppliesToDate', () => {
  // -------------------------------------------------------------------------
  // weekly
  // -------------------------------------------------------------------------

  describe('weekly frequency', () => {
    const rule = makeRule({
      frequency: 'weekly',
      anchor_date: '2025-01-15', // Wednesday
      end_date: null,
    });

    it('fires on the anchor date itself (daysDiff = 0)', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-15'))).toBe(true);
    });

    it('fires 7 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-22'))).toBe(true);
    });

    it('fires 14 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-29'))).toBe(true);
    });

    it('does not fire 1 day after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-16'))).toBe(false);
    });

    it('does not fire 6 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-21'))).toBe(false);
    });

    it('does not fire 8 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-23'))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // biweekly
  // -------------------------------------------------------------------------

  describe('biweekly frequency', () => {
    const rule = makeRule({
      frequency: 'biweekly',
      anchor_date: '2025-01-15',
      end_date: null,
    });

    it('fires on the anchor date (daysDiff = 0)', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-15'))).toBe(true);
    });

    it('fires 14 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-29'))).toBe(true);
    });

    it('fires 28 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-02-12'))).toBe(true);
    });

    it('does not fire 7 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-22'))).toBe(false);
    });

    it('does not fire 13 days after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-28'))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // monthly
  // -------------------------------------------------------------------------

  describe('monthly frequency', () => {
    const rule = makeRule({
      frequency: 'monthly',
      anchor_date: '2025-01-15',
      end_date: null,
    });

    it('fires on the anchor date', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-15'))).toBe(true);
    });

    it('fires on the same day in the next month (Feb 15)', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-02-15'))).toBe(true);
    });

    it('fires on the same day several months later', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-06-15'))).toBe(true);
    });

    it('does not fire on a different day of the month', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-02-14'))).toBe(false);
    });

    it('does not fire on the 16th', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-01-16'))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // once
  // -------------------------------------------------------------------------

  describe('once frequency', () => {
    const rule = makeRule({
      frequency: 'once',
      anchor_date: '2025-03-10',
      end_date: null,
    });

    it('fires only on the anchor date', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-03-10'))).toBe(true);
    });

    it('does not fire the day before anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-03-09'))).toBe(false);
    });

    it('does not fire the day after anchor', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-03-11'))).toBe(false);
    });

    it('does not fire a month later on the same day number', () => {
      expect(ruleAppliesToDate(rule, new Date('2025-04-10'))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases: past anchor, future anchor, end_date boundary
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('does not fire when date is before anchor', () => {
      const rule = makeRule({
        frequency: 'weekly',
        anchor_date: '2025-06-01',
        end_date: null,
      });
      expect(ruleAppliesToDate(rule, new Date('2025-05-31'))).toBe(false);
    });

    it('does not fire when date is well before a future anchor', () => {
      const rule = makeRule({
        frequency: 'monthly',
        anchor_date: '2030-01-01',
        end_date: null,
      });
      expect(ruleAppliesToDate(rule, new Date('2025-01-15'))).toBe(false);
    });

    it('fires on an anchor date that is in the past (rule is still active)', () => {
      const rule = makeRule({
        frequency: 'weekly',
        anchor_date: '2020-01-01', // Wednesday
        end_date: null,
      });
      // 2020-01-08 is 7 days after anchor — should fire
      expect(ruleAppliesToDate(rule, new Date('2020-01-08'))).toBe(true);
    });

    it('fires on end_date itself (inclusive)', () => {
      const rule = makeRule({
        frequency: 'weekly',
        anchor_date: '2025-01-15',
        end_date: '2025-01-22', // exactly one cycle later
      });
      expect(ruleAppliesToDate(rule, new Date('2025-01-22'))).toBe(true);
    });

    it('does not fire the day after end_date', () => {
      const rule = makeRule({
        frequency: 'weekly',
        anchor_date: '2025-01-15',
        end_date: '2025-01-22',
      });
      expect(ruleAppliesToDate(rule, new Date('2025-01-23'))).toBe(false);
    });

    it('does not fire on a valid cycle day that is past end_date', () => {
      const rule = makeRule({
        frequency: 'weekly',
        anchor_date: '2025-01-15',
        end_date: '2025-01-28', // before Jan 29
      });
      // Jan 29 would be day 14 (valid weekly), but end_date is Jan 28
      expect(ruleAppliesToDate(rule, new Date('2025-01-29'))).toBe(false);
    });

    it('once rule does not fire before its anchor', () => {
      const rule = makeRule({
        frequency: 'once',
        anchor_date: '2025-12-25',
        end_date: null,
      });
      expect(ruleAppliesToDate(rule, new Date('2025-12-24'))).toBe(false);
    });

    it('once rule does not fire after its anchor', () => {
      const rule = makeRule({
        frequency: 'once',
        anchor_date: '2025-12-25',
        end_date: null,
      });
      expect(ruleAppliesToDate(rule, new Date('2025-12-26'))).toBe(false);
    });
  });
});
