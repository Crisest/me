import { toBank } from '../banks/bank.mapper';
import { toCard } from '../cards/card.mapper';
import { toAccount } from '../accounts/account.mapper';
import { toTransaction } from '../transactions/transaction.mapper';
import { toUpload } from '../uploads/upload.mapper';
import { toUser } from '../users/user.mapper';
import { toGroup, toGroupWithMembers } from '../groups/group.mapper';
import {
  toBudget,
  toBudgetCategory,
  toBudgetOverride,
  toBudgetCategoryOverride,
} from '../budget/budget.mapper';
import type { GroupMember } from '@portfolio/common';
import type {
  BankRow,
  CardRow,
  AccountRow,
  TransactionRow,
  UploadRow,
  UserRow,
  GroupRow,
  BudgetRow,
  BudgetOverrideRow,
  BudgetCategoryRow,
  BudgetCategoryOverrideRow,
} from '../../db/schema';

const AT = new Date('2026-01-15T12:00:00.000Z');

describe('mappers', () => {
  it('toUser emits an ISO createdAt and the joined group ids, and never returns passwordHash', () => {
    const row: UserRow = {
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'h',
      name: 'A',
      createdAt: AT,
      updatedAt: AT,
    };
    const result = toUser(row, ['g1', 'g2']);
    expect(result).toEqual({
      id: 'u1',
      email: 'a@b.com',
      name: 'A',
      createdAt: '2026-01-15T12:00:00.000Z',
      groups: ['g1', 'g2'],
    });
    // The Mongoose toUser() this replaces never returned the hash either —
    // callers serialise this straight into register/login HTTP responses.
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('toBank passes Date objects through and hides the access token', () => {
    const row: BankRow = {
      id: 'b1',
      name: 'Chase',
      createdBy: 'u1',
      isPlaidLinked: true,
      plaidAccessToken: 'secret',
      plaidItemId: 'item',
      plaidInstitutionId: 'ins_1',
      plaidSyncCursor: 'cur',
      plaidStatus: 'connected',
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toBank(row);
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.plaidStatus).toBe('connected');
    expect(dto).not.toHaveProperty('plaidAccessToken');
    expect(dto).not.toHaveProperty('plaidSyncCursor');
  });

  it('toCard passes Date objects through unchanged', () => {
    const row: CardRow = {
      id: 'c1',
      name: 'Visa',
      bankId: 'b1',
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    expect(toCard(row).createdAt).toBeInstanceOf(Date);
  });

  it('toTransaction emits ISO date and epoch-ms timestamps', () => {
    const row: TransactionRow = {
      id: 't1',
      amount: 25.5,
      description: 'Coffee',
      category: null,
      subDescription: null,
      date: AT,
      groupId: null,
      cardId: 'c1',
      accountId: null,
      categoryId: null,
      createdBy: 'u1',
      plaidTransactionId: null,
      logoUrl: null,
      categoryIconUrl: null,
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toTransaction(row, { cardName: 'Visa', bankName: 'Chase' });
    expect(dto.date).toBe('2026-01-15T12:00:00.000Z');
    expect(dto.createdAt).toBe(AT.getTime());
    expect(dto.amount).toBe(25.5);
    expect(dto.cardName).toBe('Visa');
    expect(dto.bankName).toBe('Chase');
    // Nulls become undefined so JSON.stringify omits them, matching Mongoose.
    expect(dto.category).toBeUndefined();
    expect(dto.accountId).toBeUndefined();
  });

  it('toTransaction omits enrichment when none is supplied', () => {
    const row = {
      id: 't1',
      amount: 1,
      description: 'x',
      category: null,
      subDescription: null,
      date: AT,
      groupId: null,
      cardId: null,
      accountId: null,
      categoryId: null,
      createdBy: 'u1',
      plaidTransactionId: null,
      logoUrl: null,
      categoryIconUrl: null,
      createdAt: AT,
      updatedAt: AT,
    } as TransactionRow;
    const dto = toTransaction(row);
    expect(dto.cardName).toBeUndefined();
    expect(dto.bankName).toBeUndefined();
  });

  it('toGroup emits ISO strings and the joined member ids', () => {
    const row: GroupRow = {
      id: 'g1',
      name: 'Flat',
      inviteCode: 'ABC123',
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toGroup(row, ['u1', 'u2']);
    expect(dto.createdAt).toBe('2026-01-15T12:00:00.000Z');
    expect(dto.members).toEqual(['u1', 'u2']);
  });

  it('toBudgetCategory emits epoch-ms timestamps', () => {
    const row: BudgetCategoryRow = {
      id: 'bc1',
      name: 'Rent',
      kind: 'fixed',
      plannedAmount: 1200,
      color: null,
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toBudgetCategory(row);
    expect(dto.createdAt).toBe(AT.getTime());
    expect(dto.plannedAmount).toBe(1200);
    expect(dto.color).toBeUndefined();
  });

  it('toUpload emits an epoch-ms createdAt', () => {
    const row: UploadRow = {
      id: 'up1',
      fileName: 'jan.csv',
      fileHash: 'deadbeef',
      cardId: 'c1',
      transactionCount: 12,
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    expect(toUpload(row).createdAt).toBe(AT.getTime());
  });

  it('toAccount passes Date objects through unchanged', () => {
    const row: AccountRow = {
      id: 'ac1',
      bankId: 'b1',
      plaidAccountId: 'plaid_ac1',
      name: 'Plaid Checking',
      officialName: null,
      mask: '0000',
      type: 'depository',
      subtype: null,
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toAccount(row);
    expect(dto.createdAt).toBeInstanceOf(Date);
    expect(dto.createdAt).toBe(AT);
    expect(dto.updatedAt).toBeInstanceOf(Date);
    expect(dto.officialName).toBeUndefined();
    expect(dto.subtype).toBeUndefined();
  });

  it('toBudget emits epoch-ms timestamps', () => {
    const row: BudgetRow = {
      id: 'bu1',
      salary: 5000,
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toBudget(row);
    expect(dto.createdAt).toBe(AT.getTime());
    expect(typeof dto.createdAt).toBe('number');
    expect(dto.updatedAt).toBe(AT.getTime());
    expect(dto.salary).toBe(5000);
  });

  it('toBudgetOverride emits epoch-ms timestamps', () => {
    const row: BudgetOverrideRow = {
      id: 'bo1',
      month: 3,
      year: 2026,
      salary: 5200,
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toBudgetOverride(row);
    expect(dto.createdAt).toBe(AT.getTime());
    expect(typeof dto.createdAt).toBe('number');
    expect(dto.updatedAt).toBe(AT.getTime());
    expect(dto.month).toBe(3);
    expect(dto.year).toBe(2026);
  });

  it('toBudgetCategoryOverride emits epoch-ms timestamps', () => {
    const row: BudgetCategoryOverrideRow = {
      id: 'bco1',
      categoryId: 'bc1',
      month: 6,
      year: 2026,
      plannedAmount: 300,
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    const dto = toBudgetCategoryOverride(row);
    expect(dto.createdAt).toBe(AT.getTime());
    expect(typeof dto.createdAt).toBe('number');
    expect(dto.updatedAt).toBe(AT.getTime());
    expect(dto.categoryId).toBe('bc1');
    expect(dto.plannedAmount).toBe(300);
  });

  it('toGroupWithMembers emits ISO strings and embeds full member objects', () => {
    const row: GroupRow = {
      id: 'g1',
      name: 'Flat',
      inviteCode: 'ABC123',
      createdBy: 'u1',
      createdAt: AT,
      updatedAt: AT,
    };
    const members: GroupMember[] = [
      { id: 'u1', email: 'a@b.com', name: 'A' },
      { id: 'u2', email: 'c@d.com' },
    ];
    const dto = toGroupWithMembers(row, members);
    expect(dto.createdAt).toBe('2026-01-15T12:00:00.000Z');
    expect(typeof dto.createdAt).toBe('string');
    expect(dto.updatedAt).toBe('2026-01-15T12:00:00.000Z');
    expect(dto.members).toEqual(members);
  });
});
