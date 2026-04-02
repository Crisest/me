import { Request, Response } from 'express';
import { CreateBankPayload } from '@portfolio/common';
import { createBank, getBanksByUser } from './bank.service';

export const createBankHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const bankData: CreateBankPayload = req.body;
    const bank = await createBank(userId, bankData);
    res.status(201).json(bank);
  } catch (err) {
    req.log.error({ err }, 'Failed to create a bank');
    res.status(500).json({ error: 'Failed to create a bank' });
  }
};

export const getBanksByUserHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const banks = await getBanksByUser(userId);
    res.json(banks);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch banks');
    res.status(500).json({ error: 'Failed to fetch banks' });
  }
};
