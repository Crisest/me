import { Request, Response } from 'express';
import { getMonthlyInsights } from './transaction.insights.service';

export const getTransactionInsights = async (req: Request, res: Response) => {
  try {
    const month = parseInt(req.params.month);
    const year = req.query.year
      ? parseInt(req.query.year as string)
      : undefined;

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Invalid month parameter' });
    }

    if (year && (isNaN(year) || year < 1900 || year > 2100)) {
      return res.status(400).json({ message: 'Invalid year parameter' });
    }

    const insights = await getMonthlyInsights(req.user!.id, month, year);

    res.json(insights);
  } catch (error) {
    console.error('Error getting transaction insights:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
