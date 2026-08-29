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
import { transactions } from './transactions';
import { uploads } from './uploads';

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

  it('budget_category_overrides has the four-column composite unique', () => {
    const uq = getTableConfig(budgetCategoryOverrides).uniqueConstraints[0];
    expect(uq.columns.map(c => c.name)).toEqual([
      'created_by',
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
    expect(behaviour.account_id).toBe('cascade');
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
