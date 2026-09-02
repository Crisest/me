import { truncateAll, closeTestDb } from '../../../test/setup';
import {
  makeUser,
  makeBudgetCategory,
  makeTransaction,
} from '../../../test/helpers/factories';
import { createHousehold } from '../../modules/households/household.service';
import { setTransactionCategory } from '../transactions/transaction.service';
import { loadTagHistory, matchHistory } from './history';
import type { SuggestibleTransaction } from './suggester';

let userId: string;
let householdId: string;
let scope: { householdId: string; members: { userId: string; from: Date; to: Date | null }[] };

afterEach(truncateAll);
afterAll(closeTestDb);

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
  const household = await createHousehold('Home', userId);
  householdId = household.id;
  scope = {
    householdId,
    members: [{ userId, from: new Date('2000-01-01'), to: null }],
  };
});

const candidate = (id: string, description: string): SuggestibleTransaction => ({
  id,
  description,
  subDescription: null,
  plaidCategory: null,
  amount: 10,
  date: new Date('2026-03-01'),
});

describe('loadTagHistory', () => {
  it('keys accepted tags by normalized description', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, {
      amount: 5,
      description: 'STARBUCKS STORE 4512',
      date: new Date('2026-02-01'),
    });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });

    const history = await loadTagHistory(householdId);

    expect(history.get('starbucks store')).toBe(cat.id);
  });

  it('excludes soft-deleted tags', async () => {
    const cat = await makeBudgetCategory(userId, { householdId, kind: 'flexible' });
    const txn = await makeTransaction(userId, {
      amount: 5,
      description: 'STARBUCKS',
      date: new Date('2026-02-01'),
    });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: cat.id });
    await setTransactionCategory(scope, userId, txn.id, { categoryId: null });

    const history = await loadTagHistory(householdId);

    expect(history.has('starbucks')).toBe(false);
  });

  it("does not leak another household's tags", async () => {
    const other = await makeUser();
    const otherHousehold = await createHousehold('Theirs', other.id);
    const otherScope = {
      householdId: otherHousehold.id,
      members: [{ userId: other.id, from: new Date('2000-01-01'), to: null }],
    };
    const cat = await makeBudgetCategory(other.id, { householdId: otherHousehold.id, kind: 'flexible' });
    const txn = await makeTransaction(other.id, {
      amount: 5,
      description: 'STARBUCKS',
      date: new Date('2026-02-01'),
    });
    await setTransactionCategory(otherScope, other.id, txn.id, { categoryId: cat.id });

    const history = await loadTagHistory(householdId);

    expect(history.size).toBe(0);
  });
});

describe('matchHistory', () => {
  it('resolves an exact normalized match at confidence 1', () => {
    const history = new Map([['starbucks store', 'cat-1']]);

    const { resolved, remaining } = matchHistory(
      [candidate('t1', 'STARBUCKS STORE 9981')],
      history
    );

    expect(remaining).toEqual([]);
    expect(resolved).toEqual([
      {
        transactionId: 't1',
        categoryId: 'cat-1',
        confidence: 1,
        reason: 'Matched a previous tag for this merchant',
      },
    ]);
  });

  it('passes a non-match through to remaining', () => {
    const history = new Map([['starbucks store', 'cat-1']]);

    const { resolved, remaining } = matchHistory(
      [candidate('t1', 'LOBLAWS 12')],
      history
    );

    expect(resolved).toEqual([]);
    expect(remaining.map(t => t.id)).toEqual(['t1']);
  });

  it('does not match an empty normalized description', () => {
    const history = new Map([['', 'cat-1']]);

    const { resolved, remaining } = matchHistory([candidate('t1', '### 12')], history);

    expect(resolved).toEqual([]);
    expect(remaining.map(t => t.id)).toEqual(['t1']);
  });
});
