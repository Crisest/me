import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBudgetCategory } from '../../../test/helpers/factories';
import {
  getBudgetByUserId,
  upsertBudget,
  getBudgetOverride,
  upsertBudgetOverride,
  upsertCategoryOverride,
  deleteCategoryOverride,
} from './budget.service';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('budget.service', () => {
  it('upsertBudget inserts then updates the same row', async () => {
    const user = await makeUser();

    const created = await upsertBudget(user.id, { salary: 5000 });
    expect(created.salary).toBe(5000);

    const updated = await upsertBudget(user.id, { salary: 6000 });
    expect(updated.id).toBe(created.id);
    expect(updated.salary).toBe(6000);
  });

  it('getBudgetByUserId returns null before a budget exists', async () => {
    const user = await makeUser();
    expect(await getBudgetByUserId(user.id)).toBeNull();
  });

  it('keeps budgets isolated per user', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await upsertBudget(a.id, { salary: 1000 });
    await upsertBudget(b.id, { salary: 2000 });

    expect((await getBudgetByUserId(a.id))?.salary).toBe(1000);
    expect((await getBudgetByUserId(b.id))?.salary).toBe(2000);
  });

  it('upsertBudgetOverride is keyed on (user, month, year)', async () => {
    const user = await makeUser();

    const first = await upsertBudgetOverride(user.id, {
      month: 3,
      year: 2026,
      salary: 4000,
    });
    const second = await upsertBudgetOverride(user.id, {
      month: 3,
      year: 2026,
      salary: 4500,
    });
    expect(second.id).toBe(first.id);
    expect(second.salary).toBe(4500);

    const differentMonth = await upsertBudgetOverride(user.id, {
      month: 4,
      year: 2026,
      salary: 4000,
    });
    expect(differentMonth.id).not.toBe(first.id);
  });

  it('getBudgetOverride returns null when none is set', async () => {
    const user = await makeUser();
    expect(await getBudgetOverride(user.id, 1, 2026)).toBeNull();
  });

  it('rejects a month outside 1-12 via the CHECK constraint', async () => {
    const user = await makeUser();
    await expect(
      upsertBudgetOverride(user.id, { month: 13, year: 2026, salary: 1 })
    ).rejects.toThrow();
  });

  it('upsertCategoryOverride is keyed on (user, category, month, year)', async () => {
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id);

    const first = await upsertCategoryOverride(user.id, category.id, {
      month: 5,
      year: 2026,
      plannedAmount: 200,
    });
    const second = await upsertCategoryOverride(user.id, category.id, {
      month: 5,
      year: 2026,
      plannedAmount: 250,
    });
    expect(second.id).toBe(first.id);
    expect(second.plannedAmount).toBe(250);
  });

  it('upsertCategoryOverride rejects a missing category', async () => {
    const user = await makeUser();
    await expect(
      upsertCategoryOverride(user.id, '00000000-0000-0000-0000-000000000000', {
        month: 5,
        year: 2026,
        plannedAmount: 200,
      })
    ).rejects.toThrow('Category not found');
  });

  it('upsertCategoryOverride rejects ignored categories', async () => {
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id, {
      kind: 'ignored',
      plannedAmount: 0,
    });
    await expect(
      upsertCategoryOverride(user.id, category.id, {
        month: 5,
        year: 2026,
        plannedAmount: 200,
      })
    ).rejects.toThrow('Ignored categories cannot have a monthly target');
  });

  it('deleteCategoryOverride removes only the targeted month', async () => {
    const user = await makeUser();
    const category = await makeBudgetCategory(user.id);
    await upsertCategoryOverride(user.id, category.id, {
      month: 5,
      year: 2026,
      plannedAmount: 200,
    });
    await upsertCategoryOverride(user.id, category.id, {
      month: 6,
      year: 2026,
      plannedAmount: 300,
    });

    await deleteCategoryOverride(user.id, category.id, 5, 2026);

    const remaining = await upsertCategoryOverride(user.id, category.id, {
      month: 6,
      year: 2026,
      plannedAmount: 300,
    });
    expect(remaining.plannedAmount).toBe(300);
  });
});
