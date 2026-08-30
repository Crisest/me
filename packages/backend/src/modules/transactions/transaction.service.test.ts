import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBank,
  makeCard,
  makeAccount,
  makeTransaction,
  makeBudgetCategory,
} from '../../../test/helpers/factories';
import {
  getAllTransactions,
  createManyTransactionsByUser,
  setTransactionCategory,
} from './transaction.service';
import { checkDuplicate } from '../uploads/upload.service';
import { createHousehold } from '../households/household.service';
import type { BudgetScope } from '../../middleware/resolveBudgetScope';
import { db } from '../../db/client';
import { transactions, transactionCategories } from '../../db/schema';
import { eq } from 'drizzle-orm';

const emptyScope = (householdId: string): BudgetScope => ({ householdId, members: [] });

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

    const [tx] = await getAllTransactions(
      user.id,
      { month: 1, year: 2026 },
      emptyScope(user.id)
    );
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

    const [tx] = await getAllTransactions(
      user.id,
      { month: 1, year: 2026 },
      emptyScope(user.id)
    );
    expect(tx.accountName).toBe('Plaid Checking');
    expect(tx.accountMask).toBe('4321');
    expect(tx.bankName).toBe('Chase');
  });

  it('leaves enrichment undefined for a transaction with no card or account', async () => {
    const user = await makeUser();
    await makeTransaction(user.id, { date: new Date('2026-01-15T12:00:00Z') });

    const [tx] = await getAllTransactions(
      user.id,
      { month: 1, year: 2026 },
      emptyScope(user.id)
    );
    expect(tx.cardName).toBeUndefined();
    expect(tx.accountName).toBeUndefined();
    expect(tx.bankName).toBeUndefined();
  });
});

describe('setTransactionCategory — tag rows', () => {
  it('writes a tag row rather than transactions.category_id', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible', plannedAmount: 100, householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 50 });
    const scope = { householdId: household.id, members: [] };

    await setTransactionCategory(scope, user.id, txn.id, {
      categoryId: category.id,
    });

    const tags = await db.select().from(transactionCategories);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({
      transactionId: txn.id,
      categoryId: category.id,
      householdId: household.id,
      createdBy: user.id,
      deletedAt: null,
    });
  });

  it('replaces rather than accumulates on re-tag', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const scope = { householdId: household.id, members: [] };
    const first = await makeBudgetCategory(user.id, {
      kind: 'flexible', plannedAmount: 100, householdId: household.id,
    });
    const second = await makeBudgetCategory(user.id, {
      kind: 'flexible', plannedAmount: 100, householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 50 });

    await setTransactionCategory(scope, user.id, txn.id, { categoryId: first.id });
    await setTransactionCategory(scope, user.id, txn.id, { categoryId: second.id });

    const tags = await db.select().from(transactionCategories);
    expect(tags).toHaveLength(2);
    expect(tags.filter(t => t.deletedAt === null)).toHaveLength(1);
    expect(tags.find(t => t.deletedAt === null)!.categoryId).toBe(second.id);
  });

  it('untags by closing the live row', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const scope = { householdId: household.id, members: [] };
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible', plannedAmount: 100, householdId: household.id,
    });
    const txn = await makeTransaction(user.id, { amount: 50 });

    await setTransactionCategory(scope, user.id, txn.id, { categoryId: category.id });
    await setTransactionCategory(scope, user.id, txn.id, { categoryId: null });

    const tags = await db.select().from(transactionCategories);
    expect(tags.filter(t => t.deletedAt === null)).toHaveLength(0);
  });

  it('rejects a category from another household', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const mine = await createHousehold('Mine', a.id);
    const theirs = await createHousehold('Theirs', b.id);
    const theirCategory = await makeBudgetCategory(b.id, {
      kind: 'flexible', plannedAmount: 100, householdId: theirs.id,
    });
    const txn = await makeTransaction(a.id, { amount: 50 });

    await expect(
      setTransactionCategory({ householdId: mine.id, members: [] }, a.id, txn.id, {
        categoryId: theirCategory.id,
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a second transaction on a fixed category in one month', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const scope = { householdId: household.id, members: [] };
    const rent = await makeBudgetCategory(user.id, {
      kind: 'fixed', plannedAmount: 2000, householdId: household.id,
    });
    const first = await makeTransaction(user.id, {
      amount: 2000, date: new Date(2026, 4, 1),
    });
    const second = await makeTransaction(user.id, {
      amount: 2000, date: new Date(2026, 4, 15),
    });

    await setTransactionCategory(scope, user.id, first.id, { categoryId: rent.id });

    await expect(
      setTransactionCategory(scope, user.id, second.id, { categoryId: rent.id })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('getAllTransactions — categoryId and scope', () => {
  it('filters by categoryId through the live tag row', async () => {
    const user = await makeUser();
    const household = await createHousehold('Home', user.id);
    const scope = { householdId: household.id, members: [] };
    const category = await makeBudgetCategory(user.id, {
      kind: 'flexible', plannedAmount: 100, householdId: household.id,
    });
    const tagged = await makeTransaction(user.id, {
      amount: 50, date: new Date('2026-01-15T12:00:00Z'),
    });
    await makeTransaction(user.id, {
      amount: 20, date: new Date('2026-01-16T12:00:00Z'),
    });
    await setTransactionCategory(scope, user.id, tagged.id, { categoryId: category.id });

    const result = await getAllTransactions(
      user.id,
      { categoryId: category.id },
      scope
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(tagged.id);
    expect(result[0].categoryId).toBe(category.id);
  });

  it('defaults scope to mine — only the caller\'s own transactions', async () => {
    const user = await makeUser();
    const other = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(user.id, { date: new Date('2026-01-15T12:00:00Z') });
    await makeTransaction(other.id, { date: new Date('2026-01-16T12:00:00Z') });

    const result = await getAllTransactions(
      user.id,
      {},
      { householdId: household.id, members: [] }
    );

    expect(result).toHaveLength(1);
    expect(result[0].createdBy).toBe(user.id);
  });

  it('widens to household members with owner email and name populated', async () => {
    const user = await makeUser();
    const member = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(user.id, { date: new Date('2026-01-15T12:00:00Z') });
    await makeTransaction(member.id, { date: new Date('2026-01-16T12:00:00Z') });

    const budgetScope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: user.id, from: new Date('2020-01-01'), to: null },
        { userId: member.id, from: new Date('2020-01-01'), to: null },
      ],
    };

    const result = await getAllTransactions(
      user.id,
      { scope: 'household' },
      budgetScope
    );

    expect(result).toHaveLength(2);
    expect(result.every(tx => tx.ownerEmail)).toBe(true);
  });

  it('excludes a departed member\'s post-departure spending', async () => {
    const user = await makeUser();
    const departed = await makeUser();
    const household = await createHousehold('Home', user.id);
    await makeTransaction(departed.id, { date: new Date('2026-03-01T12:00:00Z') });

    const budgetScope: BudgetScope = {
      householdId: household.id,
      members: [
        { userId: user.id, from: new Date('2020-01-01'), to: null },
        {
          userId: departed.id,
          from: new Date('2026-01-01'),
          to: new Date('2026-02-01'),
        },
      ],
    };

    const result = await getAllTransactions(
      user.id,
      { scope: 'household' },
      budgetScope
    );

    expect(result.find(tx => tx.createdBy === departed.id)).toBeUndefined();
  });
});
