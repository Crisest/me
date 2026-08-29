import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBank,
  makeCard,
  makeAccount,
  makeTransaction,
} from '../../../test/helpers/factories';
import {
  getAllTransactions,
  createManyTransactionsByUser,
} from './transaction.service';
import { checkDuplicate } from '../uploads/upload.service';
import { db } from '../../db/client';
import { transactions } from '../../db/schema';
import { eq } from 'drizzle-orm';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('createManyTransactionsByUser', () => {
  it('inserts transactions and creates an upload record', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    const card = await makeCard(user.id, bank.id);

    const result = await createManyTransactionsByUser(user.id, {
      transactions: [
        { amount: 1, description: 'a', date: '2026-05-10' } as never,
        { amount: 2, description: 'b', date: '2026-05-10' } as never,
      ],
      cardId: card.id,
      fileName: 'statement.csv',
      fileHash: 'abc123',
    });

    expect(result).toHaveLength(2);

    const dup = await checkDuplicate(
      { fileName: 'statement.csv', fileHash: 'abc123', cardId: card.id },
      user.id
    );
    expect(dup.isDuplicate).toBe(true);
  });

  it('rolls back the upload record when transaction insertion fails', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    const card = await makeCard(user.id, bank.id);

    await expect(
      createManyTransactionsByUser(user.id, {
        // amount is NOT NULL — this batch cannot commit
        transactions: [{ description: 'bad' } as never],
        cardId: card.id,
        fileName: 'bad.csv',
        fileHash: 'bad-hash',
      })
    ).rejects.toThrow();

    const dup = await checkDuplicate(
      { fileName: 'bad.csv', fileHash: 'bad-hash', cardId: card.id },
      user.id
    );
    expect(dup.isDuplicate).toBe(false);
  });

  it('rolls back the transaction insert when the later upload-record write fails', async () => {
    // The reverse order from the test above: the transactions insert (the
    // EARLIER write in createManyTransactionsByUser) succeeds first, and the
    // upload-record insert (the LATER write) is the one that fails — a
    // NOT NULL violation on uploads.file_name, since fileName flows straight
    // into the insert unvalidated at the service layer. This is the shape a
    // non-transactional sequential implementation gets wrong: it would leave
    // the transaction rows committed even though the overall import failed.
    const user = await makeUser();
    const bank = await makeBank(user.id);
    const card = await makeCard(user.id, bank.id);

    await expect(
      createManyTransactionsByUser(user.id, {
        transactions: [
          { amount: 1, description: 'a', date: '2026-05-10' } as never,
          { amount: 2, description: 'b', date: '2026-05-10' } as never,
        ],
        cardId: card.id,
        fileName: null as never,
        fileHash: 'reverse-order-hash',
      })
    ).rejects.toThrow();

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.createdBy, user.id));
    // Pins the fix: the earlier write (the transaction rows) must not survive
    // the later write's failure.
    expect(rows).toHaveLength(0);

    const dup = await checkDuplicate(
      { fileName: 'null', fileHash: 'reverse-order-hash', cardId: card.id },
      user.id
    );
    expect(dup.isDuplicate).toBe(false);
  });
});

describe('getAllTransactions — enrichment', () => {
  it('enriches transactions with card and bank names via a join', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id, { name: 'Chase' });
    const card = await makeCard(user.id, bank.id, { name: 'Visa' });
    await makeTransaction(user.id, {
      cardId: card.id,
      date: new Date('2026-01-15T12:00:00Z'),
    });

    const [tx] = await getAllTransactions(user.id, { month: 1, year: 2026 });
    expect(tx.cardName).toBe('Visa');
    expect(tx.bankName).toBe('Chase');
  });

  it('enriches Plaid transactions with account name, mask, and bank', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id, { name: 'Chase' });
    const account = await makeAccount(user.id, bank.id, {
      name: 'Plaid Checking',
      mask: '4321',
    });
    await makeTransaction(user.id, {
      accountId: account.id,
      date: new Date('2026-01-15T12:00:00Z'),
    });

    const [tx] = await getAllTransactions(user.id, { month: 1, year: 2026 });
    expect(tx.accountName).toBe('Plaid Checking');
    expect(tx.accountMask).toBe('4321');
    expect(tx.bankName).toBe('Chase');
  });

  it('leaves enrichment undefined for a transaction with no card or account', async () => {
    const user = await makeUser();
    await makeTransaction(user.id, { date: new Date('2026-01-15T12:00:00Z') });

    const [tx] = await getAllTransactions(user.id, { month: 1, year: 2026 });
    expect(tx.cardName).toBeUndefined();
    expect(tx.accountName).toBeUndefined();
    expect(tx.bankName).toBeUndefined();
  });
});
