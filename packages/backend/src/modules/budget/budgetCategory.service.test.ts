import { eq } from 'drizzle-orm';
import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
  makeBudgetCategoryOverride,
  makeTransactionCategory,
} from '../../../test/helpers/factories';
import { db } from '../../db/client';
import { budgetCategories, transactionCategories } from '../../db/schema';
import { createHousehold, joinByCode } from '../households/household.service';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './budgetCategory.service';

let userId: string;
let scope: BudgetScope;

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
  const household = await createHousehold('Home', userId);
  scope = { householdId: household.id, members: [] };
});

describe('createCategory', () => {
  it('creates a flexible category with its planned amount', async () => {
    const result = await createCategory(scope, userId, {
      name: 'Groceries', kind: 'flexible', plannedAmount: 600,
    });

    expect(result).toMatchObject({ name: 'Groceries', kind: 'flexible', plannedAmount: 600 });
  });

  it('forces plannedAmount to 0 for an ignored category', async () => {
    const result = await createCategory(scope, userId, {
      name: 'Card payments', kind: 'ignored', plannedAmount: 500,
    });

    expect(result.plannedAmount).toBe(0);
  });

  it('rejects a flexible category with no planned amount', async () => {
    await expect(
      createCategory(scope, userId, { name: 'Groceries', kind: 'flexible' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a negative plannedAmount on a fixed category with 400', async () => {
    await expect(
      createCategory(scope, userId, { name: 'Rent', kind: 'fixed', plannedAmount: -100 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a negative plannedAmount on an ignored category and stores it as 0', async () => {
    const result = await createCategory(scope, userId, {
      name: 'Transfers', kind: 'ignored', plannedAmount: -500,
    });

    expect(result.plannedAmount).toBe(0);
  });
});

describe('listCategories', () => {
  it('returns only the household categories', async () => {
    const other = await makeUser();
    const otherHousehold = await createHousehold('Other', other.id);
    await makeBudgetCategory(userId, { name: 'Mine', householdId: scope.householdId });
    await makeBudgetCategory(other.id, { name: 'Theirs', householdId: otherHousehold.id });

    const result = await listCategories(scope);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Mine');
  });
});

describe('updateCategory', () => {
  it('404s when the category belongs to another household', async () => {
    const other = await makeUser();
    const otherHousehold = await createHousehold('Other', other.id);
    const cat = await makeBudgetCategory(other.id, { householdId: otherHousehold.id });

    await expect(
      updateCategory(scope, userId, cat.id, { name: 'Hijacked' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects switching to fixed when a month holds two of its transactions', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', householdId: scope.householdId });
    const t1 = await makeTransaction(userId, { date: new Date('2026-05-03') });
    const t2 = await makeTransaction(userId, { date: new Date('2026-05-20') });
    await makeTransactionCategory(t1.id, cat.id, scope.householdId, userId);
    await makeTransactionCategory(t2.id, cat.id, scope.householdId, userId);

    await expect(
      updateCategory(scope, userId, cat.id, { kind: 'fixed' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows switching to fixed when every month holds at most one transaction', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 50, householdId: scope.householdId });
    const t1 = await makeTransaction(userId, { date: new Date('2026-05-03') });
    const t2 = await makeTransaction(userId, { date: new Date('2026-06-03') });
    await makeTransactionCategory(t1.id, cat.id, scope.householdId, userId);
    await makeTransactionCategory(t2.id, cat.id, scope.householdId, userId);

    const result = await updateCategory(scope, userId, cat.id, { kind: 'fixed' });

    expect(result.kind).toBe('fixed');
  });

  it("lets any member edit the household's categories", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    await createHousehold('Other', b.id);
    await joinByCode(household.inviteCode, b.id);
    const memberScope = { householdId: household.id, members: [] };

    const category = await createCategory(memberScope, a.id, {
      name: 'Groceries',
      kind: 'flexible',
      plannedAmount: 400,
    });

    const updated = await updateCategory(memberScope, b.id, category.id, {
      plannedAmount: 900,
    });

    expect(updated.plannedAmount).toBe(900);
  });

  it('records who last edited a category', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await createHousehold('Home', a.id);
    const memberScope = { householdId: household.id, members: [] };
    const category = await createCategory(memberScope, a.id, {
      name: 'Rent', kind: 'fixed', plannedAmount: 2000,
    });

    await updateCategory(memberScope, b.id, category.id, { plannedAmount: 2100 });

    const [row] = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.id, category.id));
    expect(row.updatedBy).toBe(b.id);
  });
});

it('normalises plannedAmount to 0 for an ignored category', async () => {
  const user = await makeUser();
  const household = await createHousehold('Home', user.id);
  const soloScope = { householdId: household.id, members: [] };
  const category = await createCategory(soloScope, user.id, {
    name: 'Transfers',
    kind: 'ignored',
    plannedAmount: 500,
  });
  // Preserves the pre('validate') behaviour: accepted, stored as 0.
  expect(category.plannedAmount).toBe(0);
});

describe('deleteCategory', () => {
  it('soft-deletes and keeps tag rows intact', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const soloScope = { householdId: household.id, members: [] };
    const category = await createCategory(soloScope, user.id, {
      name: 'Gone', kind: 'flexible', plannedAmount: 100,
    });
    const txn = await makeTransaction(user.id, { amount: 50 });
    await makeTransactionCategory(txn.id, category.id, household.id, user.id);

    await deleteCategory(soloScope, category.id);

    const [row] = await db
      .select()
      .from(budgetCategories)
      .where(eq(budgetCategories.id, category.id));
    expect(row.deletedAt).not.toBeNull();

    const tags = await db.select().from(transactionCategories);
    expect(tags).toHaveLength(1);
    expect(tags[0].deletedAt).toBeNull();

    expect(await listCategories(soloScope)).toHaveLength(0);
  });

  it("refuses to touch another household's category", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const mine = await createHousehold('Mine', a.id);
    const theirs = await createHousehold('Theirs', b.id);
    const theirCategory = await createCategory(
      { householdId: theirs.id, members: [] },
      b.id,
      { name: 'Theirs', kind: 'flexible', plannedAmount: 100 }
    );

    await expect(
      deleteCategory({ householdId: mine.id, members: [] }, theirCategory.id)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('leaves overrides untouched by ON DELETE rules and reports 404 on a second delete', async () => {
    const cat = await makeBudgetCategory(userId, { householdId: scope.householdId });
    await makeBudgetCategoryOverride(userId, cat.id);

    await deleteCategory(scope, cat.id);

    await expect(deleteCategory(scope, cat.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('deleting a category does not touch its transactions', async () => {
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id, { householdId: scope.householdId });
    const tx = await makeTransaction(user.id);
    await makeTransactionCategory(tx.id, category.id, scope.householdId, user.id);

    await deleteCategory(scope, category.id);

    const [remaining] = await db
      .select()
      .from(transactionCategories)
      .where(eq(transactionCategories.transactionId, tx.id));

    expect(remaining).toBeDefined();
    expect(remaining.deletedAt).toBeNull();
  });
});
