import { NextFunction, Request, Response } from 'express';
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

export const createAccountHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const account = await accountService.createManualAccount(
      req.user!.id,
      req.body
    );
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
};
