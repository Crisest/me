import { toCategorySuggestion } from './categorization.mapper';
import type { CategorySuggestionRow } from '../../db/schema';

const row = (overrides: Partial<CategorySuggestionRow> = {}): CategorySuggestionRow =>
  ({
    id: 'sug-1',
    transactionId: 'txn-1',
    householdId: 'hh-1',
    categoryId: 'cat-1',
    confidence: 0.82,
    reason: 'Looks like groceries',
    source: 'claude',
    status: 'pending',
    createdBy: 'user-1',
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  }) as CategorySuggestionRow;

describe('toCategorySuggestion', () => {
  it('maps a row and its transaction join to the DTO', () => {
    const dto = toCategorySuggestion(row(), {
      id: 'txn-1',
      description: 'LOBLAWS 1234',
      subDescription: 'GROCERIES',
      amount: 84.21,
      date: new Date('2026-03-02T00:00:00Z'),
      ownerName: 'Alex',
      ownerEmail: 'alex@example.com',
    });

    expect(dto).toEqual({
      id: 'sug-1',
      categoryId: 'cat-1',
      confidence: 0.82,
      reason: 'Looks like groceries',
      source: 'claude',
      status: 'pending',
      createdAt: new Date('2026-03-01T00:00:00Z').getTime(),
      transaction: {
        id: 'txn-1',
        description: 'LOBLAWS 1234',
        subDescription: 'GROCERIES',
        amount: 84.21,
        date: '2026-03-02T00:00:00.000Z',
        ownerName: 'Alex',
        ownerEmail: 'alex@example.com',
      },
    });
  });

  it('omits a null sub-description and owner name', () => {
    const dto = toCategorySuggestion(row(), {
      id: 'txn-1',
      description: 'CASH',
      subDescription: null,
      amount: 20,
      date: new Date('2026-03-02T00:00:00Z'),
      ownerName: null,
      ownerEmail: 'alex@example.com',
    });

    expect(dto.transaction.subDescription).toBeUndefined();
    expect(dto.transaction.ownerName).toBeUndefined();
  });
});
