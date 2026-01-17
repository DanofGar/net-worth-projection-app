import { z } from 'zod';

// Recurring rule validation
export const recurringRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  amount: z.number().refine(val => val !== 0, 'Amount cannot be zero'),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'once']),
  anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  active: z.boolean().default(true),
});

export const recurringRuleUpdateSchema = recurringRuleSchema.partial();

// Account update validation (for setting payment day, primary account)
export const accountUpdateSchema = z.object({
  is_primary_payment: z.boolean().optional(),
  payment_day_of_month: z.number().min(1).max(31).nullable().optional(),
  is_liquid: z.boolean().optional(),
});

// Projection query validation
export const projectionQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(60),
  viewMode: z.enum(['net_worth', 'cash_flow']).default('net_worth'),
  scope: z.enum(['total', 'liquid']).default('total'),
});

// Teller callback validation
export const tellerCallbackSchema = z.object({
  accessToken: z.string().min(1),
  enrollment: z.object({
    id: z.string(),
    institution: z.object({
      id: z.string(),
      name: z.string(),
    }),
  }),
});

export type RecurringRule = z.infer<typeof recurringRuleSchema>;
export type RecurringRuleUpdate = z.infer<typeof recurringRuleUpdateSchema>;
export type AccountUpdate = z.infer<typeof accountUpdateSchema>;
export type ProjectionQuery = z.infer<typeof projectionQuerySchema>;
