import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
  makeBudgetCategoryOverride,
} from '../../../test/helpers/factories';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from './budgetCategory.service';

let userId: string;

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
});

describe('createCategory', () => {
  it('creates a flexible category with its planned amount', async () => {
    const result = await createCategory(userId, {
      name: 'Groceries', kind: 'flexible', plannedAmount: 600,
    });

    expect(result).toMatchObject({ name: 'Groceries', kind: 'flexible', plannedAmount: 600 });
  });

  it('forces plannedAmount to 0 for an ignored category', async () => {
    const result = await createCategory(userId, {
      name: 'Card payments', kind: 'ignored', plannedAmount: 500,
    });

    expect(result.plannedAmount).toBe(0);
  });

  it('rejects a flexible category with no planned amount', async () => {
    await expect(
      createCategory(userId, { name: 'Groceries', kind: 'flexible' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a negative plannedAmount on a fixed category with 400', async () => {
    await expect(
      createCategory(userId, { name: 'Rent', kind: 'fixed', plannedAmount: -100 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a negative plannedAmount on an ignored category and stores it as 0', async () => {
    const result = await createCategory(userId, {
      name: 'Transfers', kind: 'ignored', plannedAmount: -500,
    });

    expect(result.plannedAmount).toBe(0);
  });
});

describe('listCategories', () => {
  it('returns only the caller categories', async () => {
    const other = await makeUser();
    await makeBudgetCategory(userId, { name: 'Mine' });
    await makeBudgetCategory(other.id, { name: 'Theirs' });

    const result = await listCategories(userId);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Mine');
  });
});

describe('updateCategory', () => {
  it('404s when the category belongs to another user', async () => {
    const other = await makeUser();
    const cat = await makeBudgetCategory(other.id);

    await expect(
      updateCategory(userId, cat.id, { name: 'Hijacked' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects switching to fixed when a month holds two of its transactions', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible' });
    await makeTransaction(userId, { date: new Date('2026-05-03'), categoryId: cat.id });
    await makeTransaction(userId, { date: new Date('2026-05-20'), categoryId: cat.id });

    await expect(
      updateCategory(userId, cat.id, { kind: 'fixed' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows switching to fixed when every month holds at most one transaction', async () => {
    const cat = await makeBudgetCategory(userId, { kind: 'flexible', plannedAmount: 50 });
    await makeTransaction(userId, { date: new Date('2026-05-03'), categoryId: cat.id });
    await makeTransaction(userId, { date: new Date('2026-06-03'), categoryId: cat.id });

    const result = await updateCategory(userId, cat.id, { kind: 'fixed' });

    expect(result.kind).toBe('fixed');
  });
});

it('normalises plannedAmount to 0 for an ignored category', async () => {
  const user = await makeUser();
  const category = await createCategory(user.id, {
    name: 'Transfers',
    kind: 'ignored',
    plannedAmount: 500,
  });
  // Preserves the pre('validate') behaviour: accepted, stored as 0.
  expect(category.plannedAmount).toBe(0);
});

describe('deleteCategory', () => {
  it('untags its transactions and removes its overrides', async () => {
    const cat = await makeBudgetCategory(userId);
    const txn = await makeTransaction(userId, { categoryId: cat.id });
    await makeBudgetCategoryOverride(userId, cat.id);

    await deleteCategory(userId, cat.id);

    const { db } = await import('../../db/client');
    const { transactions, budgetCategoryOverrides } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    const [reloaded] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txn.id));
    expect(reloaded.categoryId).toBeNull();
    const overrides = await db
      .select()
      .from(budgetCategoryOverrides)
      .where(eq(budgetCategoryOverrides.categoryId, cat.id));
    expect(overrides).toHaveLength(0);
    expect(await listCategories(userId)).toHaveLength(0);
  });

  it('deleting a category untags its transactions instead of deleting them', async () => {
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id);
    const tx = await makeTransaction(user.id, { categoryId: category.id });

    await deleteCategory(user.id, category.id);

    const { db } = await import('../../db/client');
    const { transactions } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    const [remaining] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, tx.id));

    expect(remaining).toBeDefined();
    expect(remaining.categoryId).toBeNull();
  });
});
