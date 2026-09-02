import { createStubSuggester } from './stub.suggester';

describe('createStubSuggester', () => {
  it('returns only canned suggestions whose transaction was offered', async () => {
    const stub = createStubSuggester([
      { transactionId: 't1', categoryId: 'c1', confidence: 0.9, reason: 'r' },
      { transactionId: 't-absent', categoryId: 'c1', confidence: 0.9, reason: 'r' },
    ]);

    const result = await stub.suggest({
      transactions: [
        {
          id: 't1',
          description: 'COFFEE',
          subDescription: null,
          plaidCategory: null,
          amount: 5,
          date: new Date('2026-03-01'),
        },
      ],
      categories: [],
      examples: [],
    });

    expect(result).toEqual([
      { transactionId: 't1', categoryId: 'c1', confidence: 0.9, reason: 'r' },
    ]);
  });

  it('records every call so tests can assert it was not called', async () => {
    const stub = createStubSuggester([]);
    expect(stub.calls).toHaveLength(0);

    await stub.suggest({ transactions: [], categories: [], examples: [] });

    expect(stub.calls).toHaveLength(1);
  });
});
