import { Request, Response } from 'express';
import { TransactionModel } from '../transactions/transaction.model';
import { CardModel } from '../cards/card.model';
import { BankModel } from '../banks/bank.model';
import { UploadModel } from '../uploads/upload.model';
import { BudgetModel } from '../budget/budget.model';

export const resetUserData = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const results = await Promise.all([
      TransactionModel.deleteMany({ createdBy: userId }),
      CardModel.deleteMany({ createdBy: userId }),
      BankModel.deleteMany({ createdBy: userId }),
      UploadModel.deleteMany({ createdBy: userId }),
      BudgetModel.deleteMany({ createdBy: userId }),
    ]);

    const [transactions, cards, banks, uploads, budgets] = results;

    res.json({
      deleted: {
        transactions: transactions.deletedCount,
        cards: cards.deletedCount,
        banks: banks.deletedCount,
        uploads: uploads.deletedCount,
        budgets: budgets.deletedCount,
      },
    });
  } catch (err) {
    req.log.error({ err }, 'Failed to reset user data');
    res.status(500).json({ error: 'Failed to reset user data' });
  }
};
