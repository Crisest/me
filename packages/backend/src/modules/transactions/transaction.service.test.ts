import mongoose from 'mongoose';
import { setTransactionFixedExpense, createManyTransactionsByUser } from './transaction.service';
import { TransactionModel } from './transaction.model';
import { BudgetModel } from '../budget/budget.model';
import { createUploadRecord } from '../uploads/upload.service';
import { AppError } from '../../middleware/errorHandler';

jest.mock('./transaction.model');
jest.mock('../budget/budget.model');
jest.mock('../uploads/upload.service');

const mockedTransactionModel = TransactionModel as unknown as jest.Mocked<typeof TransactionModel>;
const mockedBudgetModel = BudgetModel as unknown as jest.Mocked<typeof BudgetModel>;
const mockedCreateUploadRecord = createUploadRecord as jest.MockedFunction<typeof createUploadRecord>;

const USER_A = new mongoose.Types.ObjectId().toString();
const TX_ID = new mongoose.Types.ObjectId().toString();

describe('setTransactionFixedExpense', () => {
  it('throws 404 when the transaction is not owned by the user', async () => {
    mockedTransactionModel.findOne = jest.fn().mockResolvedValue(null) as any;

    await expect(
      setTransactionFixedExpense(USER_A, TX_ID, null)
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mockedTransactionModel.findOne).toHaveBeenCalledWith({
      _id: TX_ID,
      createdBy: USER_A,
    });
  });

  it('clears the fixed expense when fixedExpenseId is null', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const toTransaction = jest.fn().mockReturnValue({ id: TX_ID });
    const txn: any = {
      _id: new mongoose.Types.ObjectId(TX_ID),
      amount: 50,
      date: new Date('2026-05-10'),
      fixedExpenseId: new mongoose.Types.ObjectId(),
      save,
      toTransaction,
    };
    mockedTransactionModel.findOne = jest.fn().mockResolvedValue(txn) as any;

    const result = await setTransactionFixedExpense(USER_A, TX_ID, null);

    expect(txn.fixedExpenseId).toBeUndefined();
    expect(save).toHaveBeenCalled();
    expect(result).toEqual({ id: TX_ID });
  });

  it('rejects matching a credit (non-debit) transaction', async () => {
    const txn: any = {
      _id: new mongoose.Types.ObjectId(TX_ID),
      amount: -10,
      date: new Date('2026-05-10'),
      save: jest.fn(),
      toTransaction: jest.fn(),
    };
    mockedTransactionModel.findOne = jest.fn().mockResolvedValue(txn) as any;

    await expect(
      setTransactionFixedExpense(USER_A, TX_ID, new mongoose.Types.ObjectId().toString())
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/debit/i) });
  });

  it('rejects when the fixed expense is not on the user budget', async () => {
    const fixedExpenseId = new mongoose.Types.ObjectId().toString();
    const txn: any = {
      _id: new mongoose.Types.ObjectId(TX_ID),
      amount: 50,
      date: new Date('2026-05-10'),
      save: jest.fn(),
      toTransaction: jest.fn(),
    };
    mockedTransactionModel.findOne = jest.fn().mockResolvedValue(txn) as any;
    mockedBudgetModel.findOne = jest.fn().mockResolvedValue({ fixedExpenses: [] }) as any;

    await expect(
      setTransactionFixedExpense(USER_A, TX_ID, fixedExpenseId)
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/fixed expense/i) });
  });

  it('rejects when another transaction in the same month is already matched', async () => {
    const fixedExpenseId = new mongoose.Types.ObjectId();
    const txn: any = {
      _id: new mongoose.Types.ObjectId(TX_ID),
      amount: 50,
      date: new Date('2026-05-10'),
      save: jest.fn(),
      toTransaction: jest.fn(),
    };
    const findOneSpy = jest.fn()
      .mockResolvedValueOnce(txn)
      .mockResolvedValueOnce({ description: 'Existing match' });
    mockedTransactionModel.findOne = findOneSpy as any;
    mockedBudgetModel.findOne = jest.fn().mockResolvedValue({
      fixedExpenses: [{ _id: fixedExpenseId }],
    }) as any;

    await expect(
      setTransactionFixedExpense(USER_A, TX_ID, fixedExpenseId.toString())
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('createManyTransactionsByUser', () => {
  it('inserts transactions and creates an upload record', async () => {
    const cardId = new mongoose.Types.ObjectId().toString();
    mockedTransactionModel.fromCreateManyPayload = jest.fn().mockReturnValue([{ amount: 1 }, { amount: 2 }]) as any;
    mockedTransactionModel.insertMany = jest.fn().mockResolvedValue([]) as any;
    mockedCreateUploadRecord.mockResolvedValue(undefined as any);

    await createManyTransactionsByUser(
      {
        transactions: [{ amount: 1, description: 'a', date: '2026-05-10' } as any, { amount: 2, description: 'b', date: '2026-05-10' } as any],
        cardId,
        fileName: 'statement.csv',
        fileHash: 'abc123',
      },
      USER_A
    );

    expect(mockedTransactionModel.insertMany).toHaveBeenCalledTimes(1);
    expect(mockedCreateUploadRecord).toHaveBeenCalledWith('statement.csv', 'abc123', cardId, 2, USER_A);
  });
});
