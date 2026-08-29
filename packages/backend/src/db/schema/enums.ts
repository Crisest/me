import { pgEnum } from 'drizzle-orm/pg-core';

export const plaidStatusEnum = pgEnum('plaid_status', [
  'connected',
  'login_required',
  'error',
]);

export const accountTypeEnum = pgEnum('account_type', [
  'depository',
  'credit',
  'loan',
  'investment',
  'other',
]);

export const categoryKindEnum = pgEnum('category_kind', [
  'fixed',
  'flexible',
  'ignored',
]);
