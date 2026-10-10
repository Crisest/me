import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBank,
  makeAccount,
} from '../../../test/helpers/factories';
import { checkDuplicate, createUploadRecord } from './upload.service';

afterEach(truncateAll);
afterAll(closeTestDb);

const setup = async () => {
  const user = await makeUser();
  const bank = await makeBank(user.id);
  const card = await makeAccount(user.id, bank.id, { plaidAccountId: null });
  return { user, card };
};

describe('upload.service', () => {
  it('records an upload', async () => {
    const { user, card } = await setup();
    const upload = await createUploadRecord(
      'jan.csv',
      'hash-1',
      card.id,
      12,
      user.id
    );

    expect(upload.fileName).toBe('jan.csv');
    expect(upload.transactionCount).toBe(12);
    expect(typeof upload.createdAt).toBe('number');
  });

  it('reports no duplicate for an unseen file', async () => {
    const { user, card } = await setup();
    const res = await checkDuplicate(
      { fileName: 'new.csv', fileHash: 'nope', accountId: card.id },
      user.id
    );
    expect(res).toEqual({ isDuplicate: false });
  });

  it('matches on hash OR name for the same account', async () => {
    const { user, card } = await setup();
    await createUploadRecord('jan.csv', 'hash-1', card.id, 5, user.id);

    const byHash = await checkDuplicate(
      { fileName: 'different.csv', fileHash: 'hash-1', accountId: card.id },
      user.id
    );
    expect(byHash.isDuplicate).toBe(true);
    expect(byHash.existingUpload?.fileName).toBe('jan.csv');

    const byName = await checkDuplicate(
      { fileName: 'jan.csv', fileHash: 'different', accountId: card.id },
      user.id
    );
    expect(byName.isDuplicate).toBe(true);
  });

  it('scopes the duplicate check to the account and the user', async () => {
    const { user, card } = await setup();
    const otherCard = await makeAccount(user.id, card.bankId, {
      name: 'Other',
      plaidAccountId: null,
    });
    await createUploadRecord('jan.csv', 'hash-1', card.id, 5, user.id);

    const otherCardResult = await checkDuplicate(
      { fileName: 'jan.csv', fileHash: 'hash-1', accountId: otherCard.id },
      user.id
    );
    expect(otherCardResult.isDuplicate).toBe(false);

    const otherUser = await makeUser();
    const otherUserResult = await checkDuplicate(
      { fileName: 'jan.csv', fileHash: 'hash-1', accountId: card.id },
      otherUser.id
    );
    expect(otherUserResult.isDuplicate).toBe(false);
  });
});
