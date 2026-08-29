import type { AccountsGetResponse } from 'plaid';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBank, makeAccount } from '../../../test/helpers/factories';
import {
  upsertPlaidAccountsForBank,
  getAccountsByUser,
  findAccountByPlaidId,
  deleteAccountsForBank,
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

  it('deleteAccountsForBank removes every account on that bank', async () => {
    const user = await makeUser();
    const bank = await makeBank(user.id);
    await makeAccount(user.id, bank.id);
    await makeAccount(user.id, bank.id);

    await deleteAccountsForBank(bank.id);
    expect(await getAccountsByUser(user.id)).toEqual([]);
  });
});
