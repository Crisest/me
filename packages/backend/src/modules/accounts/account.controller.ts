import { Request, Response } from 'express';
import * as accountService from './account.service';

export const listAccountsHandler = async (req: Request, res: Response) => {
  try {
    const accounts = await accountService.getAccountsByUser(req.user!.id);
    res.json({ accounts });
  } catch (err) {
    req.log.error({ err }, 'Failed to list accounts');
    res.status(500).json({ error: 'Failed to list accounts' });
  }
};
