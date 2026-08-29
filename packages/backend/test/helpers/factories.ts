import { v7 as uuidv7 } from 'uuid';
import { db } from '../../src/db/client';
import {
  accounts,
  banks,
  budgetCategories,
  budgetCategoryOverrides,
  cards,
  groups,
  transactions,
  users,
  type AccountRow,
  type BankRow,
  type BudgetCategoryOverrideRow,
  type BudgetCategoryRow,
  type CardRow,
  type GroupRow,
  type TransactionRow,
  type UserRow,
} from '../../src/db/schema';

/** Unique-per-call suffix so factories never collide on unique columns. */
const uniq = () => uuidv7().slice(-12);

export const makeUser = async (
  overrides: Partial<typeof users.$inferInsert> = {}
): Promise<UserRow> => {
  const [row] = await db
    .insert(users)
    .values({
      email: `user-${uniq()}@example.com`,
      passwordHash: 'hashed',
      name: 'Test User',
      ...overrides,
    })
    .returning();
  return row;
};

export const makeBank = async (
  userId: string,
  overrides: Partial<typeof banks.$inferInsert> = {}
): Promise<BankRow> => {
  const [row] = await db
    .insert(banks)
    .values({ name: 'Test Bank', createdBy: userId, ...overrides })
    .returning();
  return row;
};

export const makeCard = async (
  userId: string,
  bankId: string,
  overrides: Partial<typeof cards.$inferInsert> = {}
): Promise<CardRow> => {
  const [row] = await db
    .insert(cards)
    .values({ name: 'Test Card', bankId, createdBy: userId, ...overrides })
    .returning();
  return row;
};

export const makeAccount = async (
  userId: string,
  bankId: string,
  overrides: Partial<typeof accounts.$inferInsert> = {}
): Promise<AccountRow> => {
  const [row] = await db
    .insert(accounts)
    .values({
      bankId,
      createdBy: userId,
      plaidAccountId: `plaid-acct-${uniq()}`,
      name: 'Test Checking',
      type: 'depository',
      mask: '0000',
      ...overrides,
    })
    .returning();
  return row;
};

export const makeGroup = async (
  userId: string,
  overrides: Partial<typeof groups.$inferInsert> = {}
): Promise<GroupRow> => {
  const [row] = await db
    .insert(groups)
    .values({
      name: 'Test Group',
      inviteCode: `invite-${uniq()}`,
      createdBy: userId,
      ...overrides,
    })
    .returning();
  return row;
};

export const makeBudgetCategory = async (
  userId: string,
  overrides: Partial<typeof budgetCategories.$inferInsert> = {}
): Promise<BudgetCategoryRow> => {
  const [row] = await db
    .insert(budgetCategories)
    .values({
      name: 'Groceries',
      kind: 'flexible',
      plannedAmount: 100,
      createdBy: userId,
      ...overrides,
    })
    .returning();
  return row;
};

export const makeBudgetCategoryOverride = async (
  userId: string,
  categoryId: string,
  overrides: Partial<typeof budgetCategoryOverrides.$inferInsert> = {}
): Promise<BudgetCategoryOverrideRow> => {
  const [row] = await db
    .insert(budgetCategoryOverrides)
    .values({
      categoryId,
      createdBy: userId,
      month: 1,
      year: 2026,
      plannedAmount: 150,
      ...overrides,
    })
    .returning();
  return row;
};

export const makeTransaction = async (
  userId: string,
  overrides: Partial<typeof transactions.$inferInsert> = {}
): Promise<TransactionRow> => {
  const [row] = await db
    .insert(transactions)
    .values({
      amount: 25.5,
      description: 'Test transaction',
      date: new Date('2026-01-15T12:00:00Z'),
      createdBy: userId,
      ...overrides,
    })
    .returning();
  return row;
};
