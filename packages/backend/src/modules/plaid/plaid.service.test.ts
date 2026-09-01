import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBank, makeAccount } from '../../../test/helpers/factories';
import { db } from '../../db/client';
import { transactions, banks, accounts } from '../../db/schema';
import { eq } from 'drizzle-orm';

jest.mock('./plaid.client');

afterEach(truncateAll);
afterAll(closeTestDb);

const fakePlaidAccount = (accountId: string) => ({
  account_id: accountId,
  name: 'Checking',
  official_name: null,
  mask: '0000',
  type: 'depository',
  subtype: 'checking',
});

const fakePlaidTx = (overrides: Record<string, unknown> = {}) => ({
  transaction_id: 'plaid-tx-added',
  account_id: 'plaid-acct-1',
  amount: 9.99,
  name: 'Snacks',
  merchant_name: null,
  pending: false,
  date: '2026-01-06',
  personal_finance_category: null,
  personal_finance_category_icon_url: null,
  logo_url: null,
  ...overrides,
});

describe('plaid sync persistence', () => {
  it('re-syncing an already-imported transaction is a no-op, not a duplicate', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id, { isPlaidLinked: true });
    const account = await makeAccount(user.id, bank.id);

    const row = {
      amount: 12.5,
      description: 'Coffee',
      date: new Date('2026-01-05T12:00:00Z'),
      accountId: account.id,
      createdBy: user.id,
      plaidTransactionId: 'plaid-tx-1',
    };

    await db.insert(transactions).values(row);
    // The same batch arriving again must not throw and must not duplicate.
    await expect(
      db
        .insert(transactions)
        .values(row)
        .onConflictDoNothing({ target: transactions.plaidTransactionId })
    ).resolves.toBeDefined();

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(1);
  });

  it('does not advance the sync cursor when the transaction write fails', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidSyncCursor: 'cursor-0',
    });

    await expect(
      db.transaction(async tx => {
        await tx
          .update(banks)
          .set({ plaidSyncCursor: 'cursor-1' })
          .where(eq(banks.id, bank.id));
        // Simulates a failed transaction insert mid-sync.
        throw new Error('plaid write failed');
      })
    ).rejects.toThrow('plaid write failed');

    const [after] = await db.select().from(banks).where(eq(banks.id, bank.id));
    // Before this migration the cursor would have advanced and the
    // transactions would have been lost forever.
    expect(after.plaidSyncCursor).toBe('cursor-0');
  });

  it('deleting an account orphans its transactions instead of deleting them', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id, { isPlaidLinked: true });
    const account = await makeAccount(user.id, bank.id);
    await db.insert(transactions).values({
      amount: 5,
      description: 'x',
      date: new Date('2026-01-05T12:00:00Z'),
      accountId: account.id,
      createdBy: user.id,
      plaidTransactionId: 'plaid-tx-2',
    });

    // Nothing in the app hard-deletes accounts any more, but the FK is the
    // backstop if anything ever does — a manual DELETE must not take the
    // user's history with it.
    await db.delete(accounts).where(eq(accounts.id, account.id));

    // ON DELETE SET NULL, not CASCADE: an account row is Plaid bookkeeping,
    // but the transactions hanging off it are the user's own history.
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].accountId).toBeNull();
  });
});

describe('unlinkBank', () => {
  const stubPlaid = async () => {
    const { getPlaidClient } = await import('./plaid.client');
    const fakePlaid = { itemRemove: jest.fn().mockResolvedValue({ data: {} }) };
    (getPlaidClient as jest.Mock).mockReturnValue(fakePlaid);
    jest
      .spyOn(await import('@/utils/crypto'), 'decrypt')
      .mockReturnValue('access-token-123');
    return fakePlaid;
  };

  it('soft-deletes the accounts and leaves the history attached to them', async () => {
    await stubPlaid();
    const { unlinkBank } = await import('./plaid.service');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidItemId: 'item-1',
      plaidInstitutionId: 'ins_1',
    });
    const account = await makeAccount(user.id, bank.id);
    await db.insert(transactions).values({
      amount: 42,
      description: 'Groceries',
      date: new Date('2026-01-05T12:00:00Z'),
      accountId: account.id,
      createdBy: user.id,
      plaidTransactionId: 'plaid-tx-unlink',
    });

    await unlinkBank(user.id, bank.id);

    // Nothing is destroyed: the account row is closed, and the transaction
    // still points at it, so the history keeps its account name and mask.
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('Groceries');
    expect(rows[0].accountId).toBe(account.id);
    expect(rows[0].plaidTransactionId).toBe('plaid-tx-unlink');

    const [accountAfter] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, account.id));
    expect(accountAfter.deletedAt).not.toBeNull();

    const [after] = await db.select().from(banks).where(eq(banks.id, bank.id));
    expect(after.isPlaidLinked).toBe(false);
    expect(after.plaidAccessToken).toBeNull();
    expect(after.plaidItemId).toBeNull();
    expect(after.plaidSyncCursor).toBeNull();
    // Institution id is identity, not a credential — a later relink needs it
    // to find this row instead of inserting a second one.
    expect(after.plaidInstitutionId).toBe('ins_1');
  });

  it('hides the soft-deleted accounts from the accounts list', async () => {
    await stubPlaid();
    const { unlinkBank } = await import('./plaid.service');
    const { getAccountsByUser } = await import('../accounts/account.service');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
    });
    await makeAccount(user.id, bank.id);

    expect(await getAccountsByUser(user.id)).toHaveLength(1);
    await unlinkBank(user.id, bank.id);
    expect(await getAccountsByUser(user.id)).toHaveLength(0);
  });

  it('leaves another bank transactions untouched', async () => {
    await stubPlaid();
    const { unlinkBank } = await import('./plaid.service');

    const user = await makeUser();
    const unlinked = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
    });
    const kept = await makeBank(user.id, {
      name: 'Kept Bank',
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
    });
    await makeAccount(user.id, unlinked.id);
    const keptAccount = await makeAccount(user.id, kept.id);
    await db.insert(transactions).values({
      amount: 7,
      description: 'Kept',
      date: new Date('2026-01-05T12:00:00Z'),
      accountId: keptAccount.id,
      createdBy: user.id,
      plaidTransactionId: 'plaid-tx-kept',
    });

    await unlinkBank(user.id, unlinked.id);

    const [row] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(row.accountId).toBe(keptAccount.id);
    expect(row.plaidTransactionId).toBe('plaid-tx-kept');
  });
});

describe('exchangePublicToken (relink dedupe)', () => {
  const stubPlaid = async (plaidAccountIds: string[] = ['plaid-acct-new']) => {
    const { getPlaidClient } = await import('./plaid.client');
    const fakePlaid = {
      itemPublicTokenExchange: jest.fn().mockResolvedValue({
        data: { access_token: 'access-new', item_id: 'item-new' },
      }),
      accountsGet: jest.fn().mockResolvedValue({
        data: { accounts: plaidAccountIds.map(fakePlaidAccount) },
      }),
      itemRemove: jest.fn().mockResolvedValue({ data: {} }),
    };
    (getPlaidClient as jest.Mock).mockReturnValue(fakePlaid);
    const crypto = await import('@/utils/crypto');
    jest.spyOn(crypto, 'encrypt').mockImplementation(v => `enc:${v}`);
    jest.spyOn(crypto, 'decrypt').mockReturnValue('access-old');
    return fakePlaid;
  };

  const payload = {
    publicToken: 'public-token-1',
    institutionId: 'ins_1',
    institutionName: 'Test Bank',
  };

  it('reuses the existing bank row for an institution the user already linked', async () => {
    const fakePlaid = await stubPlaid();
    const { unlinkBank, exchangePublicToken } = await import('./plaid.service');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidItemId: 'item-old',
      plaidInstitutionId: 'ins_1',
      plaidSyncCursor: 'cursor-old',
    });
    await unlinkBank(user.id, bank.id);

    await exchangePublicToken(user.id, payload);

    const rows = await db
      .select()
      .from(banks)
      .where(eq(banks.createdBy, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(bank.id);
    expect(rows[0].plaidItemId).toBe('item-new');
    expect(rows[0].isPlaidLinked).toBe(true);
    expect(rows[0].plaidStatus).toBe('connected');
    // The old Item's cursor cannot be replayed against the new Item.
    expect(rows[0].plaidSyncCursor).toBeNull();
    expect(fakePlaid.itemPublicTokenExchange).toHaveBeenCalled();
  });

  it('revives the soft-deleted account and keeps its history attached', async () => {
    await stubPlaid(['plaid-acct-new']);
    const { unlinkBank, exchangePublicToken } = await import('./plaid.service');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidInstitutionId: 'ins_1',
    });
    const account = await makeAccount(user.id, bank.id, {
      plaidAccountId: 'plaid-acct-old',
      mask: '0000',
      type: 'depository',
      subtype: 'checking',
    });
    await db.insert(transactions).values({
      amount: 42,
      description: 'Groceries',
      date: new Date('2026-01-05T12:00:00Z'),
      accountId: account.id,
      createdBy: user.id,
      plaidTransactionId: 'plaid-tx-old',
    });

    await unlinkBank(user.id, bank.id);
    await exchangePublicToken(user.id, payload);

    // Same row, re-keyed to the new Item's account id — not a second row.
    const accountRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.bankId, bank.id));
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0].id).toBe(account.id);
    expect(accountRows[0].plaidAccountId).toBe('plaid-acct-new');
    expect(accountRows[0].deletedAt).toBeNull();

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(tx.accountId).toBe(account.id);
  });

  it('does not duplicate accounts when relinking without unlinking first', async () => {
    await stubPlaid(['plaid-acct-new']);
    const { exchangePublicToken } = await import('./plaid.service');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidInstitutionId: 'ins_1',
    });
    const account = await makeAccount(user.id, bank.id, {
      plaidAccountId: 'plaid-acct-old',
      mask: '0000',
      type: 'depository',
      subtype: 'checking',
    });

    await exchangePublicToken(user.id, payload);

    const accountRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.bankId, bank.id));
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0].id).toBe(account.id);
    expect(accountRows[0].plaidAccountId).toBe('plaid-acct-new');
  });

  it('retires the previous Item at Plaid when relinking a live bank', async () => {
    const fakePlaid = await stubPlaid();
    const { exchangePublicToken } = await import('./plaid.service');

    const user = await makeUser();
    await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidItemId: 'item-old',
      plaidInstitutionId: 'ins_1',
    });

    await exchangePublicToken(user.id, payload);

    expect(fakePlaid.itemRemove).toHaveBeenCalledWith({
      access_token: 'access-old',
    });
  });

  it('inserts a new row for a different institution', async () => {
    await stubPlaid();
    const { exchangePublicToken } = await import('./plaid.service');

    const user = await makeUser();
    await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidInstitutionId: 'ins_other',
    });

    await exchangePublicToken(user.id, payload);

    const rows = await db
      .select()
      .from(banks)
      .where(eq(banks.createdBy, user.id));
    expect(rows).toHaveLength(2);
  });

  it('does not reuse another user bank row for the same institution', async () => {
    await stubPlaid();
    const { exchangePublicToken } = await import('./plaid.service');

    const other = await makeUser();
    const user = await makeUser();
    await makeBank(other.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidInstitutionId: 'ins_1',
    });

    await exchangePublicToken(user.id, payload);

    const mine = await db
      .select()
      .from(banks)
      .where(eq(banks.createdBy, user.id));
    const theirs = await db
      .select()
      .from(banks)
      .where(eq(banks.createdBy, other.id));
    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(1);
    expect(mine[0].id).not.toBe(theirs[0].id);
  });
});

describe('syncOneBankForUser (real service, mocked Plaid API)', () => {
  it('persists added transactions and advances the cursor together', async () => {
    const { getPlaidClient } = await import('./plaid.client');
    const { syncOneBankForUser } = await import('./plaid.service');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag', // decrypt() is never reached: itemPublicTokenExchange etc. are mocked out below
      plaidSyncCursor: null,
    });

    const fakePlaid = {
      accountsGet: jest
        .fn()
        .mockResolvedValue({ data: { accounts: [fakePlaidAccount('plaid-acct-1')] } }),
      transactionsSync: jest.fn().mockResolvedValue({
        data: {
          added: [fakePlaidTx()],
          modified: [],
          removed: [],
          next_cursor: 'cursor-1',
          has_more: false,
        },
      }),
    };
    (getPlaidClient as jest.Mock).mockReturnValue(fakePlaid);

    // decrypt() is real and would throw on a fake token — stub it out via
    // the crypto module directly since only the persistence path is under test.
    jest
      .spyOn(await import('@/utils/crypto'), 'decrypt')
      .mockReturnValue('access-token-123');

    const result = await syncOneBankForUser(user.id, bank.id);

    expect(result).toEqual({ added: 1, modified: 0, removed: 0 });

    const [after] = await db.select().from(banks).where(eq(banks.id, bank.id));
    expect(after.plaidSyncCursor).toBe('cursor-1');
    expect(after.plaidStatus).toBe('connected');

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].plaidTransactionId).toBe('plaid-tx-added');
  });

  it('rolls back the cursor advance when a write inside the sync fails (the data-loss fix)', async () => {
    const { getPlaidClient } = await import('./plaid.client');
    const { syncOneBankForUser } = await import('./plaid.service');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidSyncCursor: 'cursor-0',
    });

    const fakePlaid = {
      // The account upsert (syncAccountsForBank) runs inside the same
      // transaction, before the paging loop — a non-atomic implementation
      // would let this row survive a later failure.
      accountsGet: jest
        .fn()
        .mockResolvedValue({ data: { accounts: [fakePlaidAccount('plaid-acct-1')] } }),
      transactionsSync: jest
        .fn()
        // First page succeeds and writes a real row — this is what a naive,
        // non-transactional implementation would persist immediately.
        .mockResolvedValueOnce({
          data: {
            added: [fakePlaidTx({ transaction_id: 'plaid-tx-page1' })],
            modified: [],
            removed: [],
            next_cursor: 'cursor-1',
            has_more: true,
          },
        })
        // Second page has no description available (name and merchant_name
        // both null) — violates the NOT NULL constraint on
        // transactions.description, forcing the insert inside the sync
        // transaction to fail *after* the first page's writes have already
        // happened on this connection.
        .mockResolvedValueOnce({
          data: {
            added: [
              fakePlaidTx({
                transaction_id: 'plaid-tx-page2',
                name: null,
                merchant_name: null,
              }),
            ],
            modified: [],
            removed: [],
            next_cursor: 'cursor-2',
            has_more: false,
          },
        }),
    };
    (getPlaidClient as jest.Mock).mockReturnValue(fakePlaid);
    jest
      .spyOn(await import('@/utils/crypto'), 'decrypt')
      .mockReturnValue('access-token-123');

    await expect(syncOneBankForUser(user.id, bank.id)).rejects.toThrow();

    const [after] = await db.select().from(banks).where(eq(banks.id, bank.id));
    // Pins the fix: the cursor must NOT have advanced to 'cursor-1' — before
    // this migration the cursor write and the transaction insert were
    // separate, unguarded operations, so a mid-sync failure here would have
    // permanently lost this transaction (Plaid never re-sends it once the
    // cursor moves past it).
    expect(after.plaidSyncCursor).toBe('cursor-0');
    expect(after.plaidStatus).toBe('error');

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    // The first page's transaction was written successfully inside the same
    // db.transaction() before the second page failed — a naive sequential
    // implementation would leave it committed. It must be rolled back.
    expect(rows).toHaveLength(0);

    const accountRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.createdBy, user.id));
    // The Plaid account upsert also runs inside the sync transaction, before
    // the failing insert. A naive sequential implementation would leave this
    // account row committed even though the overall sync failed.
    expect(accountRows).toHaveLength(0);
  });
});

describe('first sync after a relink (transaction adoption)', () => {
  /**
   * The relink case: the account row survived (re-keyed to the new Item), the
   * history is still on it under the *old* Item's transaction ids, and Plaid
   * is about to replay all of it under new ids.
   */
  const setup = async (
    added: ReturnType<typeof fakePlaidTx>[],
    cursor: string | null = null
  ) => {
    const { getPlaidClient } = await import('./plaid.client');
    const fakePlaid = {
      accountsGet: jest.fn().mockResolvedValue({
        data: { accounts: [fakePlaidAccount('plaid-acct-1')] },
      }),
      transactionsSync: jest.fn().mockResolvedValue({
        data: {
          added,
          modified: [],
          removed: [],
          next_cursor: 'cursor-1',
          has_more: false,
        },
      }),
    };
    (getPlaidClient as jest.Mock).mockReturnValue(fakePlaid);
    jest
      .spyOn(await import('@/utils/crypto'), 'decrypt')
      .mockReturnValue('access-token-123');

    const user = await makeUser();
    const bank = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'iv:cipher:tag',
      plaidSyncCursor: cursor,
    });
    const account = await makeAccount(user.id, bank.id, {
      plaidAccountId: 'plaid-acct-1',
      mask: '0000',
      type: 'depository',
      subtype: 'checking',
    });
    return { user, bank, account };
  };

  it('adopts an existing row instead of inserting a duplicate', async () => {
    const { syncOneBankForUser } = await import('./plaid.service');
    const { user, bank, account } = await setup([
      fakePlaidTx({
        transaction_id: 'plaid-tx-new',
        name: 'Snacks',
        amount: 9.99,
        date: '2026-01-06',
      }),
    ]);

    const [before] = await db
      .insert(transactions)
      .values({
        amount: 9.99,
        description: 'Snacks',
        // Two days off: Plaid shifts authorized vs posted dates between Items.
        date: new Date('2026-01-04T12:00:00Z'),
        accountId: account.id,
        createdBy: user.id,
        plaidTransactionId: 'plaid-tx-old',
      })
      .returning();

    const result = await syncOneBankForUser(user.id, bank.id);

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(before.id);
    expect(rows[0].plaidTransactionId).toBe('plaid-tx-new');
    expect(result).toEqual({ added: 0, modified: 1, removed: 0 });
  });

  it('keeps two identical same-day transactions as two rows', async () => {
    const { syncOneBankForUser } = await import('./plaid.service');
    const { user, bank, account } = await setup([
      fakePlaidTx({ transaction_id: 'new-a', name: 'Coffee', amount: 5 }),
      fakePlaidTx({ transaction_id: 'new-b', name: 'Coffee', amount: 5 }),
    ]);

    for (const oldId of ['old-a', 'old-b']) {
      await db.insert(transactions).values({
        amount: 5,
        description: 'Coffee',
        date: new Date('2026-01-06T12:00:00Z'),
        accountId: account.id,
        createdBy: user.id,
        plaidTransactionId: oldId,
      });
    }

    await syncOneBankForUser(user.id, bank.id);

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    // Each incoming coffee claims one candidate — neither collapses the pair.
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.plaidTransactionId).sort()).toEqual([
      'new-a',
      'new-b',
    ]);
  });

  it('still inserts a transaction with no counterpart', async () => {
    const { syncOneBankForUser } = await import('./plaid.service');
    const { user, bank, account } = await setup([
      fakePlaidTx({ transaction_id: 'new-a', name: 'Snacks', amount: 9.99 }),
      fakePlaidTx({ transaction_id: 'new-b', name: 'Petrol', amount: 40 }),
    ]);

    await db.insert(transactions).values({
      amount: 9.99,
      description: 'Snacks',
      date: new Date('2026-01-06T12:00:00Z'),
      accountId: account.id,
      createdBy: user.id,
      plaidTransactionId: 'old-a',
    });

    const result = await syncOneBankForUser(user.id, bank.id);

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(2);
    expect(result).toEqual({ added: 1, modified: 1, removed: 0 });
  });

  it('does not adopt on an ordinary incremental sync', async () => {
    const { syncOneBankForUser } = await import('./plaid.service');
    const { user, bank, account } = await setup(
      [fakePlaidTx({ transaction_id: 'new-a', name: 'Netflix', amount: 15.99 })],
      'cursor-0'
    );

    await db.insert(transactions).values({
      amount: 15.99,
      description: 'Netflix',
      date: new Date('2026-01-05T12:00:00Z'),
      accountId: account.id,
      createdBy: user.id,
      plaidTransactionId: 'old-a',
    });

    await syncOneBankForUser(user.id, bank.id);

    // A repeating subscription is not a duplicate. Adoption only runs when
    // the cursor is null, i.e. the Item is new and Plaid is replaying.
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(2);
  });

  it('does not adopt a row on a different account', async () => {
    const { syncOneBankForUser } = await import('./plaid.service');
    const { user, bank } = await setup([
      fakePlaidTx({ transaction_id: 'new-a', name: 'Snacks', amount: 9.99 }),
    ]);
    const otherBank = await makeBank(user.id, { name: 'Other' });
    const otherAccount = await makeAccount(user.id, otherBank.id);

    await db.insert(transactions).values({
      amount: 9.99,
      description: 'Snacks',
      date: new Date('2026-01-06T12:00:00Z'),
      accountId: otherAccount.id,
      createdBy: user.id,
      plaidTransactionId: 'old-a',
    });

    await syncOneBankForUser(user.id, bank.id);

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(2);
  });
});
