import { createClaudeSuggester } from './claude.suggester';
import type { SuggestibleTransaction, SuggestionInput } from './suggester';

const txn = (id: string): SuggestibleTransaction => ({
  id,
  description: `desc-${id}`,
  subDescription: 'FAST_FOOD',
  plaidCategory: 'FOOD_AND_DRINK',
  amount: 12.5,
  date: new Date('2026-03-04'),
});

const reply = (suggestions: unknown[]) => ({
  content: [{ type: 'text', text: JSON.stringify({ suggestions }) }],
});

const input = (transactions: SuggestibleTransaction[]): SuggestionInput => ({
  transactions,
  categories: [
    { id: 'cat-1', name: 'Groceries', kind: 'flexible' },
    { id: 'cat-2', name: 'Rent', kind: 'fixed' },
  ],
  examples: [{ description: 'loblaws', categoryId: 'cat-1' }],
});

const clientWith = (create: jest.Mock) =>
  ({ messages: { create } }) as never;

describe('createClaudeSuggester', () => {
  it('returns the suggestions the model produced', async () => {
    const create = jest.fn().mockResolvedValue(
      reply([{ transactionId: 't1', categoryId: 'cat-1', confidence: 0.8, reason: 'food' }])
    );
    const suggester = createClaudeSuggester(clientWith(create), 'claude-opus-5');

    const result = await suggester.suggest(input([txn('t1')]));

    expect(result).toEqual([
      { transactionId: 't1', categoryId: 'cat-1', confidence: 0.8, reason: 'food' },
    ]);
  });

  it('puts the categories in the system prompt and the transactions in the user message', async () => {
    const create = jest.fn().mockResolvedValue(reply([]));
    const suggester = createClaudeSuggester(clientWith(create), 'claude-opus-5');

    await suggester.suggest(input([txn('t1')]));

    const args = create.mock.calls[0][0];
    expect(args.system).toContain('Groceries');
    expect(args.system).not.toContain('desc-t1');
    expect(JSON.stringify(args.messages)).toContain('desc-t1');
  });

  it('chunks transactions across requests', async () => {
    const create = jest.fn().mockResolvedValue(reply([]));
    const suggester = createClaudeSuggester(clientWith(create), 'claude-opus-5', 2);

    await suggester.suggest(input([txn('t1'), txn('t2'), txn('t3')]));

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('drops entries whose transaction id was not in the chunk', async () => {
    const create = jest.fn().mockResolvedValue(
      reply([{ transactionId: 'not-offered', categoryId: 'cat-1', confidence: 0.8, reason: 'x' }])
    );
    const suggester = createClaudeSuggester(clientWith(create), 'claude-opus-5');

    expect(await suggester.suggest(input([txn('t1')]))).toEqual([]);
  });

  it('drops entries whose category id is not one of the offered categories', async () => {
    const create = jest.fn().mockResolvedValue(
      reply([{ transactionId: 't1', categoryId: 'made-up', confidence: 0.8, reason: 'x' }])
    );
    const suggester = createClaudeSuggester(clientWith(create), 'claude-opus-5');

    expect(await suggester.suggest(input([txn('t1')]))).toEqual([]);
  });

  it('drops malformed entries instead of throwing', async () => {
    const create = jest.fn().mockResolvedValue(
      reply([{ transactionId: 't1', categoryId: 'cat-1', confidence: 'high', reason: 'x' }])
    );
    const suggester = createClaudeSuggester(clientWith(create), 'claude-opus-5');

    expect(await suggester.suggest(input([txn('t1')]))).toEqual([]);
  });

  it('keeps other chunks when one chunk fails', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(
        reply([{ transactionId: 't3', categoryId: 'cat-1', confidence: 0.7, reason: 'ok' }])
      );
    const suggester = createClaudeSuggester(clientWith(create), 'claude-opus-5', 2);

    const result = await suggester.suggest(input([txn('t1'), txn('t2'), txn('t3')]));

    expect(result.map(s => s.transactionId)).toEqual(['t3']);
  });
});
