import mongoose from 'mongoose';
import { getGroupInsights } from './group.service';
import { Group } from './group.model';
import { TransactionModel } from '../transactions/transaction.model';
import { BudgetModel } from '../budget/budget.model';
import { BudgetOverrideModel } from '../budget/budgetOverride.model';

jest.mock('./group.model');
jest.mock('../transactions/transaction.model');
jest.mock('../budget/budget.model');
jest.mock('../budget/budgetOverride.model');

const mockedGroup = Group as unknown as jest.Mocked<typeof Group>;
const mockedTxn = TransactionModel as unknown as jest.Mocked<typeof TransactionModel>;
const mockedBudget = BudgetModel as unknown as jest.Mocked<typeof BudgetModel>;
const mockedOverride = BudgetOverrideModel as unknown as jest.Mocked<typeof BudgetOverrideModel>;

const MEMBER_A = new mongoose.Types.ObjectId();
const MEMBER_B = new mongoose.Types.ObjectId();
const GROUP_ID = new mongoose.Types.ObjectId().toString();

beforeEach(() => {
  jest.clearAllMocks();
  mockedGroup.findById = jest
    .fn()
    .mockResolvedValue({ members: [MEMBER_A, MEMBER_B] }) as any;
});

const aggregateResult = (totalSpent: number, debitCount: number, matched: number) => [
  {
    debits: totalSpent || debitCount ? [{ _id: null, totalSpent, debitCount }] : [],
    matchedFixed: matched ? [{ count: matched }] : [],
  },
];

it('uses each member override salary when present, else base salary', async () => {
  mockedTxn.aggregate = jest.fn().mockResolvedValue(aggregateResult(0, 0, 0)) as any;
  mockedBudget.find = jest.fn().mockResolvedValue([
    { createdBy: MEMBER_A, salary: 5000, fixedExpenses: [] },
    { createdBy: MEMBER_B, salary: 3000, fixedExpenses: [] },
  ]) as any;
  // Member A overrides to actual 5500; Member B has no override.
  mockedOverride.find = jest
    .fn()
    .mockResolvedValue([{ createdBy: MEMBER_A, salary: 5500 }]) as any;

  const result = await getGroupInsights(GROUP_ID, 5, 2026);

  expect(result.budget).toBe(8500); // 5500 (override) + 3000 (base)
  expect(result.usingActuals).toBe(true);
});

it('sets usingActuals false when no member has an override', async () => {
  mockedTxn.aggregate = jest.fn().mockResolvedValue(aggregateResult(0, 0, 0)) as any;
  mockedBudget.find = jest
    .fn()
    .mockResolvedValue([{ createdBy: MEMBER_A, salary: 5000, fixedExpenses: [] }]) as any;
  mockedOverride.find = jest.fn().mockResolvedValue([]) as any;

  const result = await getGroupInsights(GROUP_ID, 5, 2026);

  expect(result.budget).toBe(5000);
  expect(result.usingActuals).toBe(false);
});

it('excludes matched debits from totalSpent and reports matchedFixedCount', async () => {
  // Aggregation already excludes matched debits in the `debits` facet,
  // and reports 2 distinct matched fixed expenses in `matchedFixed`.
  mockedTxn.aggregate = jest.fn().mockResolvedValue(aggregateResult(1200, 10, 2)) as any;
  mockedBudget.find = jest.fn().mockResolvedValue([
    {
      createdBy: MEMBER_A,
      salary: 5000,
      fixedExpenses: [{ amount: 800 }, { amount: 200 }],
    },
  ]) as any;
  mockedOverride.find = jest.fn().mockResolvedValue([]) as any;

  const result = await getGroupInsights(GROUP_ID, 5, 2026);

  expect(result.totalSpent).toBe(1200);
  expect(result.matchedFixedCount).toBe(2);
  expect(result.totalFixed).toBe(1000);
  expect(result.moneyLeft).toBe(5000 - 1000 - 1200); // 2800
});

it('passes the matched-debit exclusion filter to the aggregation', async () => {
  mockedTxn.aggregate = jest.fn().mockResolvedValue(aggregateResult(0, 0, 0)) as any;
  mockedBudget.find = jest.fn().mockResolvedValue([]) as any;
  mockedOverride.find = jest.fn().mockResolvedValue([]) as any;

  await getGroupInsights(GROUP_ID, 5, 2026);

  const pipeline = (mockedTxn.aggregate as jest.Mock).mock.calls[0][0];
  const facet = pipeline.find((s: any) => s.$facet).$facet;
  expect(facet.debits[0].$match.$or).toEqual([
    { fixedExpenseId: { $exists: false } },
    { fixedExpenseId: null },
  ]);
  // Override query is scoped to the requested month/year.
  expect(mockedOverride.find).toHaveBeenCalledWith({
    createdBy: { $in: expect.anything() },
    month: 5,
    year: 2026,
  });
});
