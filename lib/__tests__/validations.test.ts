import { describe, it, expect } from 'vitest';
import {
  recurringRuleSchema,
  recurringRuleUpdateSchema,
  accountUpdateSchema,
  projectionQuerySchema,
  tellerCallbackSchema,
} from '../validations';

// ---------------------------------------------------------------------------
// recurringRuleSchema
// ---------------------------------------------------------------------------
describe('recurringRuleSchema', () => {
  const validRule = {
    name: 'Monthly rent',
    amount: -1500,
    frequency: 'monthly' as const,
    anchor_date: '2024-01-01',
    active: true,
  };

  it('accepts a fully valid rule', () => {
    const result = recurringRuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
  });

  it('accepts all valid frequency values', () => {
    const frequencies = ['weekly', 'biweekly', 'monthly', 'once'] as const;
    for (const frequency of frequencies) {
      const result = recurringRuleSchema.safeParse({ ...validRule, frequency });
      expect(result.success).toBe(true);
    }
  });

  it('accepts a positive amount (income)', () => {
    const result = recurringRuleSchema.safeParse({ ...validRule, amount: 3000 });
    expect(result.success).toBe(true);
  });

  it('accepts optional end_date in YYYY-MM-DD format', () => {
    const result = recurringRuleSchema.safeParse({
      ...validRule,
      end_date: '2025-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null end_date', () => {
    const result = recurringRuleSchema.safeParse({
      ...validRule,
      end_date: null,
    });
    expect(result.success).toBe(true);
  });

  it('defaults active to true when omitted', () => {
    const { active: _omitted, ...withoutActive } = validRule;
    const result = recurringRuleSchema.safeParse(withoutActive);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
    }
  });

  // Missing required fields
  it('fails when name is missing', () => {
    const { name: _omitted, ...without } = validRule;
    expect(recurringRuleSchema.safeParse(without).success).toBe(false);
  });

  it('fails when amount is missing', () => {
    const { amount: _omitted, ...without } = validRule;
    expect(recurringRuleSchema.safeParse(without).success).toBe(false);
  });

  it('fails when frequency is missing', () => {
    const { frequency: _omitted, ...without } = validRule;
    expect(recurringRuleSchema.safeParse(without).success).toBe(false);
  });

  it('fails when anchor_date is missing', () => {
    const { anchor_date: _omitted, ...without } = validRule;
    expect(recurringRuleSchema.safeParse(without).success).toBe(false);
  });

  // Wrong types
  it('fails when name is a number', () => {
    expect(recurringRuleSchema.safeParse({ ...validRule, name: 42 }).success).toBe(false);
  });

  it('fails when amount is a string', () => {
    expect(recurringRuleSchema.safeParse({ ...validRule, amount: '1500' }).success).toBe(false);
  });

  it('fails when frequency is an invalid value', () => {
    expect(
      recurringRuleSchema.safeParse({ ...validRule, frequency: 'annually' }).success
    ).toBe(false);
  });

  it('fails when active is not a boolean', () => {
    expect(recurringRuleSchema.safeParse({ ...validRule, active: 'yes' }).success).toBe(false);
  });

  // Boundary values
  it('fails when name is an empty string', () => {
    expect(recurringRuleSchema.safeParse({ ...validRule, name: '' }).success).toBe(false);
  });

  it('fails when name exceeds 100 characters', () => {
    const longName = 'a'.repeat(101);
    expect(recurringRuleSchema.safeParse({ ...validRule, name: longName }).success).toBe(false);
  });

  it('accepts name at exactly 100 characters', () => {
    const maxName = 'a'.repeat(100);
    expect(recurringRuleSchema.safeParse({ ...validRule, name: maxName }).success).toBe(true);
  });

  it('fails when amount is zero', () => {
    expect(recurringRuleSchema.safeParse({ ...validRule, amount: 0 }).success).toBe(false);
  });

  it('fails when anchor_date has wrong format', () => {
    expect(
      recurringRuleSchema.safeParse({ ...validRule, anchor_date: '01-01-2024' }).success
    ).toBe(false);
  });

  it('fails when end_date has wrong format', () => {
    expect(
      recurringRuleSchema.safeParse({ ...validRule, end_date: '31/12/2025' }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recurringRuleUpdateSchema (partial version of recurringRuleSchema)
// ---------------------------------------------------------------------------
describe('recurringRuleUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(recurringRuleUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial update with only name', () => {
    expect(recurringRuleUpdateSchema.safeParse({ name: 'New name' }).success).toBe(true);
  });

  it('accepts a partial update with only amount', () => {
    expect(recurringRuleUpdateSchema.safeParse({ amount: 500 }).success).toBe(true);
  });

  it('accepts a partial update with only frequency', () => {
    expect(recurringRuleUpdateSchema.safeParse({ frequency: 'weekly' }).success).toBe(true);
  });

  it('accepts a partial update with only anchor_date', () => {
    expect(
      recurringRuleUpdateSchema.safeParse({ anchor_date: '2025-06-15' }).success
    ).toBe(true);
  });

  it('accepts a partial update with only active', () => {
    expect(recurringRuleUpdateSchema.safeParse({ active: false }).success).toBe(true);
  });

  // Still enforces field-level constraints when fields are present
  it('fails when provided name is empty string', () => {
    expect(recurringRuleUpdateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('fails when provided amount is zero', () => {
    expect(recurringRuleUpdateSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it('fails when provided frequency is invalid', () => {
    expect(recurringRuleUpdateSchema.safeParse({ frequency: 'daily' }).success).toBe(false);
  });

  it('fails when provided anchor_date has wrong format', () => {
    expect(
      recurringRuleUpdateSchema.safeParse({ anchor_date: '2025/06/15' }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// accountUpdateSchema
// ---------------------------------------------------------------------------
describe('accountUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(accountUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts is_primary_payment true', () => {
    expect(accountUpdateSchema.safeParse({ is_primary_payment: true }).success).toBe(true);
  });

  it('accepts is_primary_payment false', () => {
    expect(accountUpdateSchema.safeParse({ is_primary_payment: false }).success).toBe(true);
  });

  it('accepts is_liquid true', () => {
    expect(accountUpdateSchema.safeParse({ is_liquid: true }).success).toBe(true);
  });

  it('accepts payment_day_of_month within valid range', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: 15 }).success).toBe(true);
  });

  it('accepts payment_day_of_month at boundary 1', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: 1 }).success).toBe(true);
  });

  it('accepts payment_day_of_month at boundary 31', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: 31 }).success).toBe(true);
  });

  it('accepts null payment_day_of_month', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: null }).success).toBe(true);
  });

  it('accepts all three fields together', () => {
    expect(
      accountUpdateSchema.safeParse({
        is_primary_payment: true,
        payment_day_of_month: 28,
        is_liquid: false,
      }).success
    ).toBe(true);
  });

  // Wrong types
  it('fails when is_primary_payment is a string', () => {
    expect(accountUpdateSchema.safeParse({ is_primary_payment: 'true' }).success).toBe(false);
  });

  it('fails when is_liquid is a number', () => {
    expect(accountUpdateSchema.safeParse({ is_liquid: 1 }).success).toBe(false);
  });

  it('fails when payment_day_of_month is a string', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: '15' }).success).toBe(false);
  });

  // Boundary violations
  it('fails when payment_day_of_month is 0', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: 0 }).success).toBe(false);
  });

  it('fails when payment_day_of_month is 32', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: 32 }).success).toBe(false);
  });

  it('fails when payment_day_of_month is negative', () => {
    expect(accountUpdateSchema.safeParse({ payment_day_of_month: -1 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// projectionQuerySchema
// ---------------------------------------------------------------------------
describe('projectionQuerySchema', () => {
  it('accepts a fully valid query', () => {
    const result = projectionQuerySchema.safeParse({
      days: '30',
      viewMode: 'net_worth',
      scope: 'total',
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults when all fields omitted', () => {
    const result = projectionQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days).toBe(60);
      expect(result.data.viewMode).toBe('net_worth');
      expect(result.data.scope).toBe('total');
    }
  });

  it('coerces days from string to number', () => {
    const result = projectionQuerySchema.safeParse({ days: '90' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.days).toBe(90);
    }
  });

  it('accepts viewMode cash_flow', () => {
    expect(projectionQuerySchema.safeParse({ viewMode: 'cash_flow' }).success).toBe(true);
  });

  it('accepts scope liquid', () => {
    expect(projectionQuerySchema.safeParse({ scope: 'liquid' }).success).toBe(true);
  });

  // Boundary values for days
  it('accepts days at minimum boundary (1)', () => {
    expect(projectionQuerySchema.safeParse({ days: '1' }).success).toBe(true);
  });

  it('accepts days at maximum boundary (365)', () => {
    expect(projectionQuerySchema.safeParse({ days: '365' }).success).toBe(true);
  });

  it('fails when days is 0 (below minimum)', () => {
    expect(projectionQuerySchema.safeParse({ days: '0' }).success).toBe(false);
  });

  it('fails when days is 366 (above maximum)', () => {
    expect(projectionQuerySchema.safeParse({ days: '366' }).success).toBe(false);
  });

  it('fails when days is negative', () => {
    expect(projectionQuerySchema.safeParse({ days: '-1' }).success).toBe(false);
  });

  // Wrong types / invalid enum values
  it('fails when viewMode is an invalid value', () => {
    expect(projectionQuerySchema.safeParse({ viewMode: 'balance' }).success).toBe(false);
  });

  it('fails when scope is an invalid value', () => {
    expect(projectionQuerySchema.safeParse({ scope: 'all' }).success).toBe(false);
  });

  it('fails when days cannot be coerced to a number', () => {
    expect(projectionQuerySchema.safeParse({ days: 'abc' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tellerCallbackSchema
// ---------------------------------------------------------------------------
describe('tellerCallbackSchema', () => {
  const validCallback = {
    accessToken: 'test_token_abc123',
    enrollment: {
      id: 'enr_001',
      institution: {
        id: 'ins_chase',
        name: 'Chase',
      },
    },
  };

  it('accepts a valid teller callback payload', () => {
    expect(tellerCallbackSchema.safeParse(validCallback).success).toBe(true);
  });

  // Missing required fields
  it('fails when accessToken is missing', () => {
    const { accessToken: _omitted, ...without } = validCallback;
    expect(tellerCallbackSchema.safeParse(without).success).toBe(false);
  });

  it('fails when enrollment is missing', () => {
    const { enrollment: _omitted, ...without } = validCallback;
    expect(tellerCallbackSchema.safeParse(without).success).toBe(false);
  });

  it('fails when enrollment.id is missing', () => {
    expect(
      tellerCallbackSchema.safeParse({
        ...validCallback,
        enrollment: {
          institution: validCallback.enrollment.institution,
        },
      }).success
    ).toBe(false);
  });

  it('fails when enrollment.institution is missing', () => {
    expect(
      tellerCallbackSchema.safeParse({
        ...validCallback,
        enrollment: { id: 'enr_001' },
      }).success
    ).toBe(false);
  });

  it('fails when institution.id is missing', () => {
    expect(
      tellerCallbackSchema.safeParse({
        ...validCallback,
        enrollment: {
          id: 'enr_001',
          institution: { name: 'Chase' },
        },
      }).success
    ).toBe(false);
  });

  it('fails when institution.name is missing', () => {
    expect(
      tellerCallbackSchema.safeParse({
        ...validCallback,
        enrollment: {
          id: 'enr_001',
          institution: { id: 'ins_chase' },
        },
      }).success
    ).toBe(false);
  });

  // Wrong types
  it('fails when accessToken is an empty string', () => {
    expect(
      tellerCallbackSchema.safeParse({ ...validCallback, accessToken: '' }).success
    ).toBe(false);
  });

  it('fails when accessToken is a number', () => {
    expect(
      tellerCallbackSchema.safeParse({ ...validCallback, accessToken: 12345 }).success
    ).toBe(false);
  });

  it('fails when enrollment is not an object', () => {
    expect(
      tellerCallbackSchema.safeParse({ ...validCallback, enrollment: 'enr_001' }).success
    ).toBe(false);
  });

  it('fails when institution.id is not a string', () => {
    expect(
      tellerCallbackSchema.safeParse({
        ...validCallback,
        enrollment: {
          id: 'enr_001',
          institution: { id: 99, name: 'Chase' },
        },
      }).success
    ).toBe(false);
  });
});
