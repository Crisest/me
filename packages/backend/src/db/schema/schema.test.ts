import { getTableConfig } from 'drizzle-orm/pg-core';
import { users } from './users';
import { primaryId } from './columns';
import { accounts } from './accounts';
import { banks } from './banks';
import { cards } from './cards';
import { groupMembers } from './group-members';
import { groups } from './groups';
import { budgetCategories } from './budget-categories';
import { budgetCategoryOverrides } from './budget-category-overrides';
import { budgetOverrides } from './budget-overrides';
import { budgets } from './budgets';
import { householdMembers } from './household-members';
import { households } from './households';
import { transactionCategories } from './transaction-categories';
import { categorySuggestions } from './category-suggestions';
import { transactions } from './transactions';
import { uploads } from './uploads';
import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeHousehold,
  makeHouseholdMember,
  makeBudgetCategory,
  makeBudgetCategoryOverride,
  makeTransaction,
  makeTransactionCategory,
  makeCategorySuggestion,
} from '../../../test/helpers/factories';

const columnNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).columns.map(c => c.name);

describe('users table', () => {
  it('maps to snake_case columns', () => {
    expect(columnNames(users).sort()).toEqual([
      'created_at',
      'email',
      'id',
      'name',
      'password_hash',
      'updated_at',
    ]);
  });

  it('names the table "users"', () => {
    expect(getTableConfig(users).name).toBe('users');
  });

  it('generates a distinct time-ordered uuid per row', () => {
    const col = primaryId();
    // `$defaultFn` is the fluent setter (it takes a fn and returns the
    // builder); the stored generator function itself lives on `config`.
    const a = col.config.defaultFn!() as string;
    const b = col.config.defaultFn!() as string;
    expect(a).not.toBe(b);
    // uuid v7 sets the version nibble to '7'
    expect(a[14]).toBe('7');
    // v7 is time-ordered, so a later id sorts after an earlier one
    expect(b > a).toBe(true);
  });

  it('requires email and passwordHash but allows a null name', () => {
    const cols = getTableConfig(users).columns;
    const byName = Object.fromEntries(cols.map(c => [c.name, c]));
    expect(byName.email.notNull).toBe(true);
    expect(byName.password_hash.notNull).toBe(true);
    expect(byName.name.notNull).toBe(false);
  });
});

describe('banks / cards / accounts tables', () => {
  it('banks has the columns from bank.model.ts', () => {
    expect(columnNames(banks).sort()).toEqual([
      'created_at',
      'created_by',
      'id',
      'is_plaid_linked',
      'name',
      'plaid_access_token',
      'plaid_institution_id',
      'plaid_item_id',
      'plaid_status',
      'plaid_sync_cursor',
      'updated_at',
    ]);
  });

  it('banks.isPlaidLinked defaults to false', () => {
    const col = getTableConfig(banks).columns.find(
      c => c.name === 'is_plaid_linked'
    )!;
    expect(col.default).toBe(false);
    expect(col.notNull).toBe(true);
  });

  it('cards.bankId cascades on bank delete', () => {
    const fk = getTableConfig(cards)
      .foreignKeys.map(f => f.reference())
      .find(r => r.foreignColumns[0].name === 'id' && r.foreignTable === banks)!;
    expect(fk).toBeDefined();
    expect(getTableConfig(cards).foreignKeys[0].onDelete).toBe('cascade');
  });

  it('accounts.plaidAccountId is unique and not null', () => {
    const col = getTableConfig(accounts).columns.find(
      c => c.name === 'plaid_account_id'
    )!;
    expect(col.isUnique).toBe(true);
    expect(col.notNull).toBe(true);
  });

  it('accounts.type is the account_type enum with all five values', () => {
    const col = getTableConfig(accounts).columns.find(c => c.name === 'type')!;
    expect((col as unknown as { enumValues: string[] }).enumValues).toEqual([
      'depository',
      'credit',
      'loan',
      'investment',
      'other',
    ]);
  });
});

describe('groups / group_members tables', () => {
  it('groups.inviteCode is unique', () => {
    const col = getTableConfig(groups).columns.find(
      c => c.name === 'invite_code'
    )!;
    expect(col.isUnique).toBe(true);
    expect(col.notNull).toBe(true);
  });

  it('group_members is keyed on (group_id, user_id)', () => {
    const pk = getTableConfig(groupMembers).primaryKeys[0];
    expect(pk.columns.map(c => c.name)).toEqual(['group_id', 'user_id']);
  });

  it('group_members has no surrogate id and no updated_at', () => {
    expect(columnNames(groupMembers).sort()).toEqual([
      'group_id',
      'joined_at',
      'user_id',
    ]);
  });

  it('both group_members foreign keys cascade', () => {
    const fks = getTableConfig(groupMembers).foreignKeys;
    expect(fks).toHaveLength(2);
    expect(fks.every(f => f.onDelete === 'cascade')).toBe(true);
  });
});

describe('budget tables', () => {
  it('budget_categories carries the kind/plannedAmount check constraint', () => {
    const names = getTableConfig(budgetCategories).checks.map(c => c.name);
    expect(names).toContain('budget_categories_planned_amount_kind_ck');
  });

  it('money columns are numeric(12,2) in number mode', () => {
    for (const [table, column] of [
      [budgetCategories, 'planned_amount'],
      [budgets, 'salary'],
      [budgetOverrides, 'salary'],
      [budgetCategoryOverrides, 'planned_amount'],
    ] as const) {
      const col = getTableConfig(table).columns.find(c => c.name === column)!;
      expect(col.getSQLType()).toBe('numeric(12, 2)');
      expect(col.dataType).toBe('number');
    }
  });

  it('budgets.createdBy is unique (one budget per user)', () => {
    const col = getTableConfig(budgets).columns.find(
      c => c.name === 'created_by'
    )!;
    expect(col.isUnique).toBe(true);
  });

  it('budget_overrides has the (createdBy, month, year) composite unique', () => {
    const uq = getTableConfig(budgetOverrides).uniqueConstraints[0];
    expect(uq.name).toBe('budget_overrides_user_month_year_uq');
    expect(uq.columns.map(c => c.name)).toEqual(['created_by', 'month', 'year']);
  });

  it('budget_category_overrides has the three-column composite unique', () => {
    const uq = getTableConfig(budgetCategoryOverrides).uniqueConstraints[0];
    expect(uq.name).toBe('bco_category_month_year_uq');
    expect(uq.columns.map(c => c.name)).toEqual([
      'category_id',
      'month',
      'year',
    ]);
  });
});

describe('transactions table', () => {
  it('has every column from transaction.model.ts', () => {
    expect(columnNames(transactions).sort()).toEqual([
      'account_id',
      'amount',
      'card_id',
      'category',
      'category_icon_url',
      'category_id',
      'created_at',
      'created_by',
      'date',
      'description',
      'group_id',
      'id',
      'logo_url',
      'plaid_transaction_id',
      'sub_description',
      'updated_at',
    ]);
  });

  it('amount is numeric(12,2) in number mode and not null', () => {
    const col = getTableConfig(transactions).columns.find(
      c => c.name === 'amount'
    )!;
    expect(col.getSQLType()).toBe('numeric(12, 2)');
    expect(col.dataType).toBe('number');
    expect(col.notNull).toBe(true);
  });

  it('only createdBy is a required foreign key', () => {
    const byName = Object.fromEntries(
      getTableConfig(transactions).columns.map(c => [c.name, c])
    );
    expect(byName.created_by.notNull).toBe(true);
    for (const nullable of ['card_id', 'account_id', 'group_id', 'category_id']) {
      expect(byName[nullable].notNull).toBe(false);
    }
  });

  it('applies the documented delete behaviours', () => {
    const behaviour = Object.fromEntries(
      getTableConfig(transactions).foreignKeys.map(f => [
        f.reference().columns[0].name,
        f.onDelete,
      ])
    );
    expect(behaviour.category_id).toBe('set null');
    expect(behaviour.card_id).toBe('set null');
    expect(behaviour.group_id).toBe('set null');
    // An account is Plaid bookkeeping tied to an Item; the transactions on it
    // are the user's history and outlive an unlink. Only the owning user
    // cascades.
    expect(behaviour.account_id).toBe('set null');
    expect(behaviour.created_by).toBe('cascade');
  });

  it('plaidTransactionId is unique but nullable', () => {
    const col = getTableConfig(transactions).columns.find(
      c => c.name === 'plaid_transaction_id'
    )!;
    expect(col.isUnique).toBe(true);
    expect(col.notNull).toBe(false);
  });
});

describe('uploads table', () => {
  it('has the columns from upload.model.ts plus updated_at', () => {
    expect(columnNames(uploads).sort()).toEqual([
      'card_id',
      'created_at',
      'created_by',
      'file_hash',
      'file_name',
      'id',
      'transaction_count',
      'updated_at',
    ]);
  });

  it('keeps both lookup indexes non-unique', () => {
    const idx = getTableConfig(uploads).indexes;
    expect(idx).toHaveLength(2);
    expect(idx.every(i => i.config.unique !== true)).toBe(true);
  });
});

import { db } from '../client';

describe('relational query API', () => {
  it('exposes a query builder for every table', () => {
    for (const table of [
      'users',
      'banks',
      'cards',
      'accounts',
      'budgetCategories',
      'budgets',
      'budgetOverrides',
      'budgetCategoryOverrides',
      'groups',
      'groupMembers',
      'transactions',
      'uploads',
    ]) {
      expect(db.query).toHaveProperty(table);
    }
  });
});

describe('household tables', () => {
  it('households has the expected columns and a unique invite code', () => {
    const t = getTableConfig(households);
    expect(columnNames(households)).toEqual(
      expect.arrayContaining([
        'id', 'name', 'invite_code', 'archived', 'created_by',
        'created_at', 'updated_at',
      ])
    );
    const inviteCode = t.columns.find(c => c.name === 'invite_code');
    expect(inviteCode?.isUnique).toBe(true);
  });

  it('households.created_by is nullable so a household outlives its creator', () => {
    const createdBy = getTableConfig(households).columns.find(
      c => c.name === 'created_by'
    );
    expect(createdBy?.notNull).toBe(false);
  });

  it('household_members carries a surrogate id and soft-delete column', () => {
    expect(columnNames(householdMembers)).toEqual(
      expect.arrayContaining([
        'id', 'household_id', 'user_id', 'created_at', 'updated_at', 'deleted_at',
      ])
    );
    // A composite primary key would make rejoining impossible.
    const pk = getTableConfig(householdMembers).primaryKeys;
    expect(pk).toHaveLength(0);
  });

  it('transaction_categories links a transaction to a category per household', () => {
    expect(columnNames(transactionCategories)).toEqual(
      expect.arrayContaining([
        'id', 'transaction_id', 'category_id', 'household_id',
        'created_by', 'created_at', 'updated_at', 'deleted_at',
      ])
    );
  });

  it('budget_categories gains household_id, updated_by and deleted_at', () => {
    expect(columnNames(budgetCategories)).toEqual(
      expect.arrayContaining(['household_id', 'updated_by', 'deleted_at'])
    );
  });

  it('category_suggestions proposes a category for a transaction', () => {
    expect(columnNames(categorySuggestions)).toEqual(
      expect.arrayContaining([
        'id', 'transaction_id', 'household_id', 'category_id', 'confidence',
        'reason', 'source', 'status', 'created_by', 'resolved_by',
        'resolved_at', 'created_at', 'updated_at', 'deleted_at',
      ])
    );
  });
});

describe('household relational query API', () => {
  it('exposes the new tables on db.query', () => {
    expect(db.query.households).toBeDefined();
    expect(db.query.householdMembers).toBeDefined();
    expect(db.query.transactionCategories).toBeDefined();
    expect(db.query.categorySuggestions).toBeDefined();
  });
});

describe('household constraints', () => {
  afterEach(truncateAll);
  afterAll(closeTestDb);

  it('allows only one active membership per user', async () => {
    const user = await makeUser();
    const first = await makeHousehold(user.id);
    const second = await makeHousehold(user.id);
    await makeHouseholdMember(first.id, user.id);

    await expect(makeHouseholdMember(second.id, user.id)).rejects.toThrow();
  });

  it('allows a closed membership alongside an active one', async () => {
    const user = await makeUser();
    const first = await makeHousehold(user.id);
    const second = await makeHousehold(user.id);
    await makeHouseholdMember(first.id, user.id, { deletedAt: new Date() });

    await expect(
      makeHouseholdMember(second.id, user.id)
    ).resolves.toBeDefined();
  });

  it('allows only one live tag per transaction per household', async () => {
    const user = await makeUser();
    const household = await makeHousehold(user.id);
    const category = await makeBudgetCategory(user.id, {
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 10 });
    await makeTransactionCategory(txn.id, category.id, household.id, user.id);

    await expect(
      makeTransactionCategory(txn.id, category.id, household.id, user.id)
    ).rejects.toThrow();
  });

  it('allows two households to tag the same transaction', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const one = await makeHousehold(a.id);
    const two = await makeHousehold(b.id);
    const catOne = await makeBudgetCategory(a.id, { householdId: one.id });
    const catTwo = await makeBudgetCategory(b.id, { householdId: two.id });
    const txn = await makeTransaction(a.id, { amount: 10 });

    await makeTransactionCategory(txn.id, catOne.id, one.id, a.id);
    await expect(
      makeTransactionCategory(txn.id, catTwo.id, two.id, b.id)
    ).resolves.toBeDefined();
  });

  it('allows only one live suggestion per transaction per household', async () => {
    const user = await makeUser();
    const household = await makeHousehold(user.id);
    const category = await makeBudgetCategory(user.id, {
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 10 });
    await makeCategorySuggestion(txn.id, category.id, household.id, user.id);

    await expect(
      makeCategorySuggestion(txn.id, category.id, household.id, user.id)
    ).rejects.toThrow();
  });

  it('allows a new suggestion once the prior one is soft-deleted', async () => {
    const user = await makeUser();
    const household = await makeHousehold(user.id);
    const category = await makeBudgetCategory(user.id, {
      householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 10 });
    await makeCategorySuggestion(txn.id, category.id, household.id, user.id, {
      deletedAt: new Date(),
    });

    await expect(
      makeCategorySuggestion(txn.id, category.id, household.id, user.id)
    ).resolves.toBeDefined();
  });

  it('allows only one override per category per month', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const household = await makeHousehold(a.id);
    const category = await makeBudgetCategory(a.id, {
      householdId: household.id,
    });
    await makeBudgetCategoryOverride(a.id, category.id, { month: 5, year: 2026 });

    await expect(
      makeBudgetCategoryOverride(b.id, category.id, { month: 5, year: 2026 })
    ).rejects.toThrow();
  });
});
