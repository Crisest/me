import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { CountryCode, Products, Transaction as PlaidTransaction } from 'plaid';
import { getPlaidClient } from './plaid.client';
import { db, type Tx } from '../../db/client';
import { accounts, banks, transactions, type BankRow } from '../../db/schema';
import { encrypt, decrypt } from '@/utils/crypto';
import { PlaidPayloads, PlaidLinkedBank } from '@portfolio/common';
import {
  findPlaidLinkedBanksByUser,
  findPlaidBankByIdForUser,
  findBankByInstitutionForUser,
} from '../banks/bank.service';
import { toBank } from '../banks/bank.mapper';
import {
  upsertPlaidAccountsForBank,
  softDeleteAccountsForBank,
} from '../accounts/account.service';

export async function createLinkToken(userId: string): Promise<string> {
  const plaid = getPlaidClient();
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Portfolio Finance',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us, CountryCode.Ca],
    language: 'en',
  });
  return response.data.link_token;
}

export async function exchangePublicToken(
  userId: string,
  payload: PlaidPayloads.ExchangeTokenRequest
): Promise<PlaidLinkedBank> {
  const plaid = getPlaidClient();
  const exchange = await plaid.itemPublicTokenExchange({
    public_token: payload.publicToken,
  });

  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  // A relink of an institution the user already has must land on the existing
  // row — that is what keeps its (soft-deleted) accounts, and the history
  // hanging off them, connected to the new Item.
  const existing = await findBankByInstitutionForUser(
    userId,
    payload.institutionId
  );

  const values = {
    name: payload.institutionName,
    isPlaidLinked: true,
    plaidAccessToken: encrypt(accessToken),
    plaidItemId: itemId,
    plaidInstitutionId: payload.institutionId,
    // Cursors are Item-scoped: the old one is not replayable against the new
    // Item, so the next sync starts from scratch.
    plaidSyncCursor: null,
    plaidStatus: 'connected' as const,
  };

  let bank: BankRow;
  if (existing) {
    // Relinking a still-live bank leaves the old Item running (and billable)
    // on Plaid's side. Best-effort: a failure here must not block the relink.
    if (existing.plaidAccessToken) {
      try {
        await plaid.itemRemove({
          access_token: decrypt(existing.plaidAccessToken),
        });
      } catch {
        // Old Item stays live at Plaid; local state is still correct.
      }
    }
    [bank] = await db
      .update(banks)
      .set(values)
      .where(eq(banks.id, existing.id))
      .returning();
  } else {
    [bank] = await db
      .insert(banks)
      .values({ ...values, createdBy: userId })
      .returning();
  }

  try {
    await syncAccountsForBank(bank);
  } catch (err) {
    // Account sync failure shouldn't block the link — txs sync will retry.
  }

  return toBank(bank) as PlaidLinkedBank;
}

type SyncCounts = PlaidPayloads.SyncResponse;

/**
 * Persists a set of accounts already fetched from Plaid. Pure DB write, no
 * network I/O — safe to run inside a db.transaction().
 */
async function upsertAccounts(
  bank: BankRow,
  plaidAccounts: Parameters<typeof upsertPlaidAccountsForBank>[2],
  executor: Tx | typeof db = db
): Promise<Map<string, string>> {
  const rows = await upsertPlaidAccountsForBank(
    bank.createdBy,
    bank.id,
    plaidAccounts,
    executor
  );

  const map = new Map<string, string>();
  for (const row of rows) map.set(row.plaidAccountId, row.id);
  return map;
}

async function syncAccountsForBank(
  bank: BankRow,
  executor: Tx | typeof db = db
): Promise<Map<string, string>> {
  const plaid = getPlaidClient();
  const accessToken = decrypt(bank.plaidAccessToken!);

  const response = await plaid.accountsGet({ access_token: accessToken });
  return upsertAccounts(bank, response.data.accounts, executor);
}

function mapPlaidTxToRow(
  tx: PlaidTransaction,
  userId: string,
  accountIdByPlaidId: Map<string, string>
) {
  return {
    amount: tx.amount,
    description: tx.merchant_name ?? tx.name,
    category: tx.personal_finance_category?.primary,
    subDescription: tx.personal_finance_category?.detailed,
    date: new Date(tx.date),
    plaidTransactionId: tx.transaction_id,
    accountId: accountIdByPlaidId.get(tx.account_id),
    logoUrl: tx.logo_url ?? undefined,
    categoryIconUrl: tx.personal_finance_category_icon_url ?? undefined,
    createdBy: userId,
  };
}

type MappedTxRow = ReturnType<typeof mapPlaidTxToRow>;

/**
 * How far a replayed transaction's date may drift from the local row it
 * matches. Plaid can report a different date for the same purchase under a
 * new Item (authorised vs posted), so an exact date match is too strict.
 */
const ADOPTION_DATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const normaliseDescription = (d: string): string =>
  d.trim().toLowerCase().replace(/\s+/g, ' ');

/** Compares money as integer cents — 9.99 never equals 9.99 in float land. */
const toCents = (amount: number): number => Math.round(amount * 100);

const adoptionKey = (r: {
  // undefined when Plaid sent a transaction for an account it did not also
  // return; such a row can never match a stored one, which is correct.
  accountId: string | null | undefined;
  amount: number;
  description: string;
}): string =>
  `${r.accountId}|${toCents(r.amount)}|${normaliseDescription(r.description)}`;

/**
 * Re-links replayed Plaid transactions to the rows the user already has.
 *
 * A new Item mints new transaction ids for purchases already synced under the
 * old one, so `plaidTransactionId` cannot recognise them and every row would
 * insert a second time. Matching on account + amount + description + a date
 * window does recognise them.
 *
 * Candidates are consumed one at a time, which is what keeps two identical
 * same-day purchases as two rows: the second incoming copy cannot claim the
 * candidate the first one took. That property is also why this is not a
 * unique index — a constraint on those columns would collapse the pair
 * permanently.
 *
 * Returns the rows that found no counterpart and must still be inserted.
 */
async function adoptReplayedTransactions(
  tx: Tx,
  userId: string,
  accountIds: string[],
  incoming: MappedTxRow[]
): Promise<{ toInsert: MappedTxRow[]; adopted: number }> {
  if (accountIds.length === 0 || incoming.length === 0) {
    return { toInsert: incoming, adopted: 0 };
  }

  const existing = await tx
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      description: transactions.description,
      date: transactions.date,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.createdBy, userId),
        inArray(transactions.accountId, accountIds)
      )
    );

  const candidates = new Map<string, { id: string; date: Date }[]>();
  for (const row of existing) {
    const key = adoptionKey(row);
    const bucket = candidates.get(key);
    if (bucket) bucket.push({ id: row.id, date: row.date });
    else candidates.set(key, [{ id: row.id, date: row.date }]);
  }

  const toInsert: MappedTxRow[] = [];
  let adopted = 0;

  for (const row of incoming) {
    const bucket = candidates.get(adoptionKey(row));
    // Closest date wins, so a run of similar purchases pairs up in order
    // rather than by whichever row the database happened to return first.
    let bestIndex = -1;
    let bestDelta = Infinity;
    bucket?.forEach((c, i) => {
      const delta = Math.abs(c.date.getTime() - row.date.getTime());
      if (delta <= ADOPTION_DATE_WINDOW_MS && delta < bestDelta) {
        bestDelta = delta;
        bestIndex = i;
      }
    });

    if (bestIndex === -1 || !bucket) {
      toInsert.push(row);
      continue;
    }

    const [claimed] = bucket.splice(bestIndex, 1);
    await tx
      .update(transactions)
      .set({
        plaidTransactionId: row.plaidTransactionId,
        // Enrichment is safe to refresh. Date, amount and description are
        // deliberately left alone: they already matched, and nudging a date
        // across a month boundary would silently move the transaction into a
        // different budget period.
        category: row.category,
        subDescription: row.subDescription,
        logoUrl: row.logoUrl,
        categoryIconUrl: row.categoryIconUrl,
      })
      .where(eq(transactions.id, claimed.id));
    adopted += 1;
  }

  return { toInsert, adopted };
}

async function syncBank(bank: BankRow): Promise<SyncCounts> {
  if (!bank.isPlaidLinked || !bank.plaidAccessToken) {
    throw new Error(`Bank ${bank.id} is not Plaid-linked`);
  }

  const plaid = getPlaidClient();
  const accessToken = decrypt(bank.plaidAccessToken);
  const userId = bank.createdBy;

  let cursor = bank.plaidSyncCursor || undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;

  try {
    // Drain every Plaid round-trip (accounts + all transaction pages) into
    // memory FIRST, with no DB transaction open. A pool connection must
    // never sit pinned across network I/O — see the plaid.service module
    // docs / final-review fix report. Only the DB writes below run inside
    // db.transaction(), so the atomicity guarantee (all writes + cursor
    // commit or roll back together) is unchanged.
    const accountsResponse = await plaid.accountsGet({
      access_token: accessToken,
    });

    const pendingAdded: PlaidTransaction[] = [];
    const pendingModified: PlaidTransaction[] = [];
    const pendingRemovedIds: string[] = [];

    let hasMore = true;
    while (hasMore) {
      const response = await plaid.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      const data = response.data;

      pendingAdded.push(...data.added.filter(t => !t.pending));
      pendingModified.push(...data.modified.filter(t => !t.pending));
      pendingRemovedIds.push(
        ...data.removed
          .map(r => r.transaction_id)
          .filter((id): id is string => !!id)
      );

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    await db.transaction(async tx => {
      const accountIdByPlaidId = await upsertAccounts(
        bank,
        accountsResponse.data.accounts,
        tx
      );

      if (pendingAdded.length > 0) {
        let toInsert = pendingAdded.map(t =>
          mapPlaidTxToRow(t, userId, accountIdByPlaidId)
        );

        // A null cursor means this Item has never been synced — either a
        // first link (nothing to adopt) or a relink, where Plaid is about to
        // replay history this bank's accounts already hold. Incremental syncs
        // skip this entirely: there, a repeat of the same amount and merchant
        // is a genuine second purchase, not a duplicate.
        if (bank.plaidSyncCursor === null) {
          const result = await adoptReplayedTransactions(
            tx,
            userId,
            [...accountIdByPlaidId.values()],
            toInsert
          );
          toInsert = result.toInsert;
          modified += result.adopted;
        }

        if (toInsert.length > 0) {
          await tx
            .insert(transactions)
            .values(toInsert)
            .onConflictDoNothing({ target: transactions.plaidTransactionId });
        }
        added = toInsert.length;
      }

      for (const t of pendingModified) {
        const row = mapPlaidTxToRow(t, userId, accountIdByPlaidId);
        await tx
          .insert(transactions)
          .values(row)
          .onConflictDoUpdate({
            target: transactions.plaidTransactionId,
            set: {
              amount: row.amount,
              description: row.description,
              category: row.category,
              subDescription: row.subDescription,
              date: row.date,
              accountId: row.accountId,
              logoUrl: row.logoUrl,
              categoryIconUrl: row.categoryIconUrl,
            },
          });
        modified += 1;
      }

      if (pendingRemovedIds.length > 0) {
        const result = await tx
          .delete(transactions)
          .where(
            and(
              inArray(transactions.plaidTransactionId, pendingRemovedIds),
              eq(transactions.createdBy, userId)
            )
          )
          .returning({ id: transactions.id });
        removed = result.length;
      }

      await tx
        .update(banks)
        .set({ plaidSyncCursor: cursor, plaidStatus: 'connected' })
        .where(eq(banks.id, bank.id));
    });

    return { added, modified, removed };
  } catch (err: any) {
    const plaidCode = err?.response?.data?.error_code;
    await db
      .update(banks)
      .set({
        plaidStatus: plaidCode === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error',
      })
      .where(eq(banks.id, bank.id));
    throw err;
  }
}

export async function syncOneBankForUser(
  userId: string,
  bankId: string
): Promise<SyncCounts> {
  const bank = await findPlaidBankByIdForUser(userId, bankId);
  if (!bank) throw new Error('Plaid-linked bank not found');
  return syncBank(bank);
}

export async function syncAllBanksForUser(userId: string): Promise<SyncCounts> {
  const linkedBanks = await findPlaidLinkedBanksByUser(userId);
  const totals: SyncCounts = { added: 0, modified: 0, removed: 0 };
  for (const bank of linkedBanks) {
    try {
      const r = await syncBank(bank);
      totals.added += r.added;
      totals.modified += r.modified;
      totals.removed += r.removed;
    } catch {
      // Per-bank failure already updated plaidStatus; continue with others
    }
  }
  return totals;
}

export async function createUpdateLinkToken(
  userId: string,
  bankId: string
): Promise<string> {
  const bank = await findPlaidBankByIdForUser(userId, bankId);
  if (!bank) throw new Error('Plaid-linked bank not found');

  const plaid = getPlaidClient();
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Portfolio Finance',
    country_codes: [CountryCode.Us, CountryCode.Ca],
    language: 'en',
    access_token: decrypt(bank.plaidAccessToken!),
  });
  return response.data.link_token;
}

export async function resyncBank(
  userId: string,
  bankId: string
): Promise<SyncCounts> {
  const bank = await findPlaidBankByIdForUser(userId, bankId);
  if (!bank) throw new Error('Plaid-linked bank not found');

  const accountRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.bankId, bank.id));
  const accountIds = accountRows.map(a => a.id);

  await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.createdBy, bank.createdBy),
        or(
          inArray(transactions.accountId, accountIds),
          and(
            isNotNull(transactions.plaidTransactionId),
            isNull(transactions.accountId)
          )
        )
      )
    );

  const [updated] = await db
    .update(banks)
    .set({ plaidSyncCursor: null })
    .where(eq(banks.id, bank.id))
    .returning();

  return syncBank(updated);
}

export async function unlinkBank(
  userId: string,
  bankId: string
): Promise<void> {
  const bank = await findPlaidBankByIdForUser(userId, bankId);
  if (!bank) throw new Error('Plaid-linked bank not found');

  try {
    const plaid = getPlaidClient();
    await plaid.itemRemove({ access_token: decrypt(bank.plaidAccessToken!) });
  } catch {
    // If Plaid call fails we still locally unlink — avoids orphaned local state
  }

  await db.transaction(async tx => {
    await tx
      .update(banks)
      .set({
        isPlaidLinked: false,
        plaidAccessToken: null,
        plaidItemId: null,
        // plaidInstitutionId is deliberately kept: it is identity, not a
        // credential, and a later relink needs it to find this row.
        plaidSyncCursor: null,
        plaidStatus: null,
      })
      .where(eq(banks.id, bank.id));

    await softDeleteAccountsForBank(bankId, tx);
  });
}
