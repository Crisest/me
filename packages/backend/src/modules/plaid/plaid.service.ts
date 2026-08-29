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
} from '../banks/bank.service';
import { toBank } from '../banks/bank.mapper';
import {
  upsertPlaidAccountsForBank,
  deleteAccountsForBank,
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

  const [bank] = await db
    .insert(banks)
    .values({
      name: payload.institutionName,
      createdBy: userId,
      isPlaidLinked: true,
      plaidAccessToken: encrypt(accessToken),
      plaidItemId: itemId,
      plaidInstitutionId: payload.institutionId,
      plaidStatus: 'connected',
    })
    .returning();

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
        await tx
          .insert(transactions)
          .values(
            pendingAdded.map(t => mapPlaidTxToRow(t, userId, accountIdByPlaidId))
          )
          .onConflictDoNothing({ target: transactions.plaidTransactionId });
        added = pendingAdded.length;
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

  await db
    .update(banks)
    .set({
      isPlaidLinked: false,
      plaidAccessToken: null,
      plaidItemId: null,
      plaidInstitutionId: null,
      plaidSyncCursor: null,
      plaidStatus: null,
    })
    .where(eq(banks.id, bank.id));

  await deleteAccountsForBank(bankId);
}
