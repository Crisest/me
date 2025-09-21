import { Request, Response } from 'express';
import { BankService } from './bank.service';
import { CreateBankPayload } from '@portfolio/common';

export class BankController {
  static async createBank(req: Request, res: Response) {
    const userId = req.user?.id;
    const bankData: CreateBankPayload = req.body;

    const bank = await BankService.createBank(userId, bankData);
    res.status(201).json(bank);
  }

  static async getBanksByUser(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const banks = await BankService.getBanksByUser(userId);
      res.json(banks);
    } catch (err) {
      console.log(JSON.stringify(err));
      res.status(500).json({ error: 'Failed to fetch banks' });
    }
  }
}
