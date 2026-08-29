import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeBank } from '../../../test/helpers/factories';
import {
  createBank,
  getBanksByUser,
  findPlaidBankByIdForUser,
  findPlaidLinkedBanksByUser,
} from './bank.service';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('bank.service', () => {
  it('creates a bank owned by the user, not Plaid-linked', async () => {
    const user = await makeUser();
    const bank = await createBank(user.id, { name: 'Chase' });

    expect(bank.name).toBe('Chase');
    expect(bank.createdBy).toBe(user.id);
    expect(bank.isPlaidLinked).toBe(false);
    expect(bank.createdAt).toBeInstanceOf(Date);
    expect(bank).not.toHaveProperty('plaidAccessToken');
  });

  it('returns only the requesting user banks', async () => {
    const a = await makeUser();
    const b = await makeUser();
    await makeBank(a.id, { name: 'A Bank' });
    await makeBank(b.id, { name: 'B Bank' });

    const banks = await getBanksByUser(a.id);
    expect(banks).toHaveLength(1);
    expect(banks[0].name).toBe('A Bank');
  });

  it('returns an empty array when the user has no banks', async () => {
    const user = await makeUser();
    expect(await getBanksByUser(user.id)).toEqual([]);
  });

  it('findPlaidBankByIdForUser returns the row including the access token', async () => {
    const user = await makeUser();
    const linked = await makeBank(user.id, {
      isPlaidLinked: true,
      plaidAccessToken: 'access-token',
    });

    const found = await findPlaidBankByIdForUser(user.id, linked.id);
    expect(found?.plaidAccessToken).toBe('access-token');
  });

  it('findPlaidBankByIdForUser ignores non-Plaid banks and other users', async () => {
    const user = await makeUser();
    const other = await makeUser();
    const manual = await makeBank(user.id, { isPlaidLinked: false });
    const otherLinked = await makeBank(other.id, { isPlaidLinked: true });

    expect(await findPlaidBankByIdForUser(user.id, manual.id)).toBeUndefined();
    expect(
      await findPlaidBankByIdForUser(user.id, otherLinked.id)
    ).toBeUndefined();
  });

  it('findPlaidLinkedBanksByUser returns only linked banks', async () => {
    const user = await makeUser();
    await makeBank(user.id, { isPlaidLinked: false });
    await makeBank(user.id, { isPlaidLinked: true });

    const linked = await findPlaidLinkedBanksByUser(user.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].isPlaidLinked).toBe(true);
  });
});
