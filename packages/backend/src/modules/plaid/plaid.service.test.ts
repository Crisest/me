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

  it('deleting an account cascades to its Plaid transactions', async () => {
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

    const { deleteAccountsForBank } = await import(
      '../accounts/account.service'
    );
    await deleteAccountsForBank(bank.id);

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    expect(rows).toHaveLength(0);
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
