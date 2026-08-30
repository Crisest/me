import { NextFunction, Request, Response } from 'express';
import { getMonthlyInsights } from './transaction.insights.service';

export const getTransactionInsights = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const month = parseInt(req.params.month);

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }

    const query = req.query as { year?: number; scope?: 'mine' | 'household' };

    const insights = await getMonthlyInsights(
      req.budgetScope!,
      req.user!.id,
      month,
      query.year,
      query.scope ?? 'mine'
    );

    res.json(insights);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch transaction insights');
    next(err);
  }
};
