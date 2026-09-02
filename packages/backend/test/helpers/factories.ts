import { v7 as uuidv7 } from 'uuid';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../src/db/client';
import {
  accounts,
  banks,
  budgetCategories,
  budgetCategoryOverrides,
  cards,
  categorySuggestions,
  groups,
  householdMembers,
  households,
  transactionCategories,
  transactions,
  users,
  type AccountRow,
  type BankRow,
  type BudgetCategoryOverrideRow,
  type BudgetCategoryRow,
  type CardRow,
  type CategorySuggestionRow,
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
  const householdId = overrides.householdId ?? (await resolveHouseholdId(userId));
  const [row] = await db
    .insert(budgetCategories)
    .values({
      name: 'Groceries',
      kind: 'flexible',
      plannedAmount: 100,
      createdBy: userId,
      ...overrides,
      householdId,
    })
    .returning();
  return row;
};

/**
 * `budget_categories.household_id` is NOT NULL. Test fixtures written before
 * households existed call `makeBudgetCategory` without one, so resolve it
 * from the user's active membership, creating a household for them if they
 * don't have one yet.
 */
const resolveHouseholdId = async (userId: string): Promise<string> => {
  const membership = await db.query.householdMembers.findFirst({
    where: and(
      eq(householdMembers.userId, userId),
      isNull(householdMembers.deletedAt)
    ),
  });
  if (membership) return membership.householdId;

  const household = await makeHousehold(userId);
  await makeHouseholdMember(household.id, userId);
  return household.id;
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

export const makeHousehold = async (
  userId: string,
  overrides: Partial<typeof households.$inferInsert> = {}
) => {
  const [row] = await db
    .insert(households)
    .values({
      name: `Household ${uniq()}`,
      inviteCode: uniq().slice(0, 6),
      createdBy: userId,
      ...overrides,
    })
    .returning();
  return row;
};

export const makeHouseholdMember = async (
  householdId: string,
  userId: string,
  overrides: Partial<typeof householdMembers.$inferInsert> = {}
) => {
  const [row] = await db
    .insert(householdMembers)
    .values({ householdId, userId, ...overrides })
    .returning();
  return row;
};

export const makeTransactionCategory = async (
  transactionId: string,
  categoryId: string,
  householdId: string,
  userId: string,
  overrides: Partial<typeof transactionCategories.$inferInsert> = {}
) => {
  const [row] = await db
    .insert(transactionCategories)
    .values({
      transactionId,
      categoryId,
      householdId,
      createdBy: userId,
      ...overrides,
    })
    .returning();
  return row;
};

export const makeCategorySuggestion = async (
  transactionId: string,
  categoryId: string,
  householdId: string,
  userId: string,
  overrides: Partial<typeof categorySuggestions.$inferInsert> = {}
): Promise<CategorySuggestionRow> => {
  const [row] = await db
    .insert(categorySuggestions)
    .values({
      transactionId,
      categoryId,
      householdId,
      confidence: 0.9,
      reason: 'Test reason',
      source: 'stub',
      createdBy: userId,
      ...overrides,
    })
    .returning();
  return row;
};
