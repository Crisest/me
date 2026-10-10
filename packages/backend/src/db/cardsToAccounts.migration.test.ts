import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { truncateAll, closeTestDb } from '../../test/setup';
import {
  makeUser,
  makeBank,
  makeCard,
  makeAccount,
  makeTransaction,
} from '../../test/helpers/factories';
import { db } from './client';
import { accounts, transactions, uploads } from './schema';

afterEach(truncateAll);
afterAll(closeTestDb);

const migrationSql = fs.readFileSync(
  path.join(__dirname, 'migrations/0008_cards_to_accounts.sql'),
  'utf8'
);

const runMigration = async () => {
  for (const part of migrationSql.split('--> statement-breakpoint')) {
    await db.execute(sql.raw(part));
  }
};

const seed = async () => {
  const user = await makeUser();
  const bank = await makeBank(user.id);
  const card = await makeCard(user.id, bank.id, { name: 'BMO Card' });
  const tx = await makeTransaction(user.id, { cardId: card.id });
  const [upload] = await db
    .insert(uploads)
    .values({
      fileName: 'a.csv',
      fileHash: 'hash',
      cardId: card.id,
      transactionCount: 1,
      createdBy: user.id,
    })
    .returning();
  return { user, bank, card, tx, upload };
};

describe('0008_cards_to_accounts', () => {
  it('copies each card into a manual account with the same id', async () => {
    const { card, bank } = await seed();
    await runMigration();

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, card.id),
    });
    expect(account).toMatchObject({
      id: card.id,
      plaidAccountId: null,
      type: 'other',
      name: 'BMO Card',
      bankId: bank.id,
    });
  });

  it('backfills transactions.account_id', async () => {
    const { card, tx } = await seed();
    await runMigration();

    const row = await db.query.transactions.findFirst({
      where: eq(transactions.id, tx.id),
    });
    expect(row?.accountId).toBe(card.id);
  });

  it('backfills uploads.account_id', async () => {
    const { card, upload } = await seed();
    await runMigration();

    const row = await db.query.uploads.findFirst({
      where: eq(uploads.id, upload.id),
    });
    expect(row?.accountId).toBe(card.id);
  });

  it('leaves a Plaid transaction that already has an account unchanged', async () => {
    const { user, bank } = await seed();
    const plaidAccount = await makeAccount(user.id, bank.id);
    const plaidTx = await makeTransaction(user.id, {
      accountId: plaidAccount.id,
    });
    await runMigration();

    const row = await db.query.transactions.findFirst({
      where: eq(transactions.id, plaidTx.id),
    });
    expect(row?.accountId).toBe(plaidAccount.id);
    expect(row?.cardId).toBeNull();
  });

  it('is idempotent', async () => {
    const { card, tx } = await seed();
    await runMigration();
    await runMigration();

    const copies = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, card.id));
    expect(copies).toHaveLength(1);
    const row = await db.query.transactions.findFirst({
      where: eq(transactions.id, tx.id),
    });
    expect(row?.accountId).toBe(card.id);
  });
});
