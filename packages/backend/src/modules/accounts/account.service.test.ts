import type { AccountsGetResponse } from 'plaid';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { accounts } from '../../db/schema';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBank, makeAccount } from '../../../test/helpers/factories';
import {
  upsertPlaidAccountsForBank,
  getAccountsByUser,
  findAccountByPlaidId,
  softDeleteAccountsForBank,
  normaliseType,
} from './account.service';

afterEach(truncateAll);
afterAll(closeTestDb);

type PlaidAccount = AccountsGetResponse['accounts'][number];

const plaidAccount = (over: Partial<PlaidAccount> = {}): PlaidAccount =>
  ({
    account_id: 'plaid-1',
    name: 'Plaid Checking',
    official_name: 'Plaid Gold Checking',
    mask: '0000',
    type: 'depository',
    subtype: 'checking',
    balances: {},
    ...over,
  }) as PlaidAccount;

describe('account.service', () => {
  it('normaliseType maps unknown types to "other"', () => {
    expect(normaliseType('depository')).toBe('depository');
    expect(normaliseType('credit')).toBe('credit');
    expect(normaliseType('brokerage')).toBe('other');
    expect(normaliseType(null)).toBe('other');
    expect(normaliseType(undefined)).toBe('other');
  });

  it('inserts new Plaid accounts', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);

    const rows = await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount(),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].plaidAccountId).toBe('plaid-1');
    expect(rows[0].name).toBe('Plaid Checking');
    expect(rows[0].type).toBe('depository');
    expect(rows[0].createdBy).toBe(user.id);
  });

  it('updates mutable fields on re-sync without duplicating the row', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);

    await upsertPlaidAccountsForBank(user.id, bank.id, [plaidAccount()]);
    await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount({ name: 'Renamed Checking', mask: '9999' }),
    ]);

    const rows = await upsertPlaidAccountsForBank(user.id, bank.id, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Renamed Checking');
    expect(rows[0].mask).toBe('9999');
  });

  it('preserves createdBy on conflict ($setOnInsert semantics)', async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const bank = await makeBank(owner.id);

    await upsertPlaidAccountsForBank(owner.id, bank.id, [plaidAccount()]);
    await upsertPlaidAccountsForBank(intruder.id, bank.id, [
      plaidAccount({ name: 'Hijacked' }),
    ]);

    const found = await findAccountByPlaidId(owner.id, 'plaid-1');
    expect(found?.createdBy).toBe(owner.id);
    expect(found?.name).toBe('Hijacked');
  });

  it('is a no-op for an empty account list', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    await expect(
      upsertPlaidAccountsForBank(user.id, bank.id, [])
    ).resolves.toEqual([]);
  });

  it('getAccountsByUser returns DTOs scoped to the user', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const bankA = await makeBank(a.id);
    const bankB = await makeBank(b.id);
    await makeAccount(a.id, bankA.id, { name: 'Mine' });
    await makeAccount(b.id, bankB.id, { name: 'Theirs' });

    const list = await getAccountsByUser(a.id);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Mine');
    expect(list[0].createdAt).toBeInstanceOf(Date);
  });

  it('softDeleteAccountsForBank hides every account on that bank', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    await makeAccount(user.id, bank.id);
    await makeAccount(user.id, bank.id);

    await softDeleteAccountsForBank(bank.id);
    expect(await getAccountsByUser(user.id)).toEqual([]);

    // Hidden, not gone — a relink revives these rows.
    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.bankId, bank.id));
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.deletedAt !== null)).toBe(true);
  });

  it('re-keys an account across a relink instead of duplicating it', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    const [before] = await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount({ account_id: 'plaid-old' }),
    ]);
    await softDeleteAccountsForBank(bank.id);

    // Same real account, new Item: different account_id, same mask/type/subtype.
    const after = await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount({ account_id: 'plaid-new' }),
    ]);

    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before.id);
    expect(after[0].plaidAccountId).toBe('plaid-new');
    expect(after[0].deletedAt).toBeNull();
  });

  it('does not merge two accounts that share a mask but differ in subtype', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount({ account_id: 'plaid-chk', subtype: 'checking' }),
      plaidAccount({ account_id: 'plaid-sav', subtype: 'savings' }),
    ]);

    const rows = await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount({ account_id: 'plaid-chk2', subtype: 'checking' }),
      plaidAccount({ account_id: 'plaid-sav2', subtype: 'savings' }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.subtype).sort()).toEqual(['checking', 'savings']);
  });

  it('inserts rather than guesses when the account has no mask', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount({ account_id: 'plaid-a', mask: null }),
    ]);

    const rows = await upsertPlaidAccountsForBank(user.id, bank.id, [
      plaidAccount({ account_id: 'plaid-b', mask: null }),
    ]);

    // type+subtype alone is too coarse to claim these are the same account.
    expect(rows).toHaveLength(2);
  });
});
