import { and, eq, sql } from 'drizzle-orm';
import { AccountsGetResponse } from 'plaid';
import { Account, AccountType } from '@portfolio/common';
import { db, type Db, type Tx } from '../../db/client';
import { accounts, type AccountRow } from '../../db/schema';
import { toAccount } from './account.mapper';

type PlaidAccount = AccountsGetResponse['accounts'][number];

/**
 * References Postgres's `excluded` pseudo-table inside ON CONFLICT DO UPDATE —
 * the values from the row that failed to insert. Batch upserts need this
 * because each row in the batch has different values.
 *
 * `sql.raw` is safe here because `column` is never user input — every call
 * site passes a literal from this file.
 */
const sqlExcluded = (column: string) => sql.raw(`excluded.${column}`);

export function normaliseType(t: string | null | undefined): AccountType {
  switch (t) {
    case 'depository':
    case 'credit':
    case 'loan':
    case 'investment':
      return t;
    default:
      return 'other';
  }
}

/**
 * Replaces bulkWrite({ $set, $setOnInsert }, { upsert: true }).
 *
 * The `set` object below holds exactly the old $set fields. The
 * $setOnInsert fields (plaidAccountId, createdBy) are deliberately absent
 * from `set`, so INSERT writes them and a conflicting UPDATE leaves them
 * alone — which is what $setOnInsert meant.
 */
export async function upsertPlaidAccountsForBank(
  userId: string,
  bankId: string,
  plaidAccounts: PlaidAccount[],
  executor: Db | Tx = db
): Promise<AccountRow[]> {
  if (plaidAccounts.length > 0) {
    await executor
      .insert(accounts)
      .values(
        plaidAccounts.map(a => ({
          bankId,
          plaidAccountId: a.account_id,
          name: a.name,
          officialName: a.official_name ?? null,
          mask: a.mask ?? null,
          type: normaliseType(a.type),
          subtype: a.subtype ?? null,
          createdBy: userId,
        }))
      )
      .onConflictDoUpdate({
        target: accounts.plaidAccountId,
        set: {
          bankId,
          name: sqlExcluded('name'),
          officialName: sqlExcluded('official_name'),
          mask: sqlExcluded('mask'),
          type: sqlExcluded('type'),
          subtype: sqlExcluded('subtype'),
        },
      });
  }

  return executor
    .select()
    .from(accounts)
    .where(and(eq(accounts.bankId, bankId), eq(accounts.createdBy, userId)));
}

export async function getAccountsByUser(userId: string): Promise<Account[]> {
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.createdBy, userId));
  return rows.map(toAccount);
}

export async function findAccountByPlaidId(
  userId: string,
  plaidAccountId: string
): Promise<AccountRow | undefined> {
  return db.query.accounts.findFirst({
    where: and(
      eq(accounts.createdBy, userId),
      eq(accounts.plaidAccountId, plaidAccountId)
    ),
  });
}

export async function deleteAccountsForBank(
  bankId: string,
  executor: Db | Tx = db
): Promise<void> {
  await executor.delete(accounts).where(eq(accounts.bankId, bankId));
}
