import { and, eq, isNull, sql } from 'drizzle-orm';
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
/**
 * A real-world account, identified without Plaid's help.
 *
 * Plaid account ids are Item-scoped: relink a bank and the same chequing
 * account comes back under a brand-new `account_id`. `mask + type + subtype`
 * is what stays put across that boundary, so it is what lets an existing row
 * (live or soft-deleted) be recognised and re-keyed instead of duplicated.
 *
 * Returns null when `mask` is absent — type+subtype alone is far too coarse
 * to claim two rows are the same account, and a wrong match would move
 * somebody's transactions onto the wrong account.
 */
function identityKey(a: {
  mask: string | null;
  type: string;
  subtype: string | null;
}): string | null {
  if (!a.mask) return null;
  return `${a.mask}|${a.type}|${a.subtype ?? ''}`;
}

export async function upsertPlaidAccountsForBank(
  userId: string,
  bankId: string,
  plaidAccounts: PlaidAccount[],
  executor: Db | Tx = db
): Promise<AccountRow[]> {
  if (plaidAccounts.length > 0) {
    const existing = await executor
      .select()
      .from(accounts)
      .where(and(eq(accounts.bankId, bankId), eq(accounts.createdBy, userId)));

    const incoming = plaidAccounts.map(a => ({
      plaidAccountId: a.account_id,
      name: a.name,
      officialName: a.official_name ?? null,
      mask: a.mask ?? null,
      type: normaliseType(a.type),
      subtype: a.subtype ?? null,
    }));

    // Two passes so an exact id match always wins over a heuristic one: a
    // row claimed by its own Plaid id can never be stolen by another
    // incoming account that happens to share a mask.
    const claimed = new Set<string>();
    const matches = new Map<string, AccountRow>();

    for (const a of incoming) {
      const byId = existing.find(
        r => r.plaidAccountId === a.plaidAccountId && !claimed.has(r.id)
      );
      if (byId) {
        claimed.add(byId.id);
        matches.set(a.plaidAccountId, byId);
      }
    }

    for (const a of incoming) {
      if (matches.has(a.plaidAccountId)) continue;
      const key = identityKey(a);
      if (!key) continue;
      const byIdentity = existing.find(
        r => !claimed.has(r.id) && identityKey(r) === key
      );
      if (byIdentity) {
        claimed.add(byIdentity.id);
        matches.set(a.plaidAccountId, byIdentity);
      }
    }

    for (const a of incoming) {
      const match = matches.get(a.plaidAccountId);
      if (match) {
        await executor
          .update(accounts)
          .set({
            // Re-key to the new Item's id, and reopen the row if a previous
            // unlink closed it. Transactions keep pointing at the same id.
            plaidAccountId: a.plaidAccountId,
            name: a.name,
            officialName: a.officialName,
            mask: a.mask,
            type: a.type,
            subtype: a.subtype,
            deletedAt: null,
          })
          .where(eq(accounts.id, match.id));
      } else {
        await executor
          .insert(accounts)
          .values({ ...a, bankId, createdBy: userId })
          .onConflictDoUpdate({
            target: accounts.plaidAccountId,
            set: {
              bankId,
              name: sqlExcluded('name'),
              officialName: sqlExcluded('official_name'),
              mask: sqlExcluded('mask'),
              type: sqlExcluded('type'),
              subtype: sqlExcluded('subtype'),
              deletedAt: sql`NULL`,
            },
          });
      }
    }
  }

  return executor
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.bankId, bankId),
        eq(accounts.createdBy, userId),
        isNull(accounts.deletedAt)
      )
    );
}

export async function getAccountsByUser(userId: string): Promise<Account[]> {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.createdBy, userId), isNull(accounts.deletedAt)));
  return rows.map(toAccount);
}

export async function findAccountByPlaidId(
  userId: string,
  plaidAccountId: string
): Promise<AccountRow | undefined> {
  return db.query.accounts.findFirst({
    where: and(
      eq(accounts.createdBy, userId),
      eq(accounts.plaidAccountId, plaidAccountId),
      isNull(accounts.deletedAt)
    ),
  });
}

/**
 * Closes a bank's accounts without touching the transactions hanging off
 * them — the rows stay joinable, so unlinked history keeps its account name
 * and mask and can be revived by a relink.
 */
export async function softDeleteAccountsForBank(
  bankId: string,
  executor: Db | Tx = db
): Promise<void> {
  await executor
    .update(accounts)
    .set({ deletedAt: new Date() })
    .where(and(eq(accounts.bankId, bankId), isNull(accounts.deletedAt)));
}
