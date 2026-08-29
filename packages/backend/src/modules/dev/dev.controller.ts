import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { transactions } from '../../db/schema/transactions';
import { cards } from '../../db/schema/cards';
import { banks } from '../../db/schema/banks';
import { uploads } from '../../db/schema/uploads';
import { budgets } from '../../db/schema/budgets';

export const resetUserData = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const deleted = await db.transaction(async tx => {
      // Delete children before parents so counts reflect rows this handler
      // actually removed, rather than rows already gone via FK cascade
      // (uploads -> cards -> banks).
      const deletedTransactions = await tx
        .delete(transactions)
        .where(eq(transactions.createdBy, userId))
        .returning({ id: transactions.id });
      const deletedUploads = await tx
        .delete(uploads)
        .where(eq(uploads.createdBy, userId))
        .returning({ id: uploads.id });
      const deletedCards = await tx
        .delete(cards)
        .where(eq(cards.createdBy, userId))
        .returning({ id: cards.id });
      const deletedBanks = await tx
        .delete(banks)
        .where(eq(banks.createdBy, userId))
        .returning({ id: banks.id });
      const deletedBudgets = await tx
        .delete(budgets)
        .where(eq(budgets.createdBy, userId))
        .returning({ id: budgets.id });

      return {
        transactions: deletedTransactions.length,
        cards: deletedCards.length,
        banks: deletedBanks.length,
        uploads: deletedUploads.length,
        budgets: deletedBudgets.length,
      };
    });

    res.json({ deleted });
  } catch (err) {
    req.log.error({ err }, 'Failed to reset user data');
    res.status(500).json({ error: 'Failed to reset user data' });
  }
};
