import { Request, Response } from 'express';
import { CreateBankPayload } from '@portfolio/common';
import { createBank } from './bank.service';
import { BankModel } from './bank.model';

export class BankController {
  static async createBank(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const bankData: CreateBankPayload = req.body;

      const bank = await createBank(userId, bankData);
      res.status(201).json(bank);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create a bank', message: e });
    }
  }

  static async getBanksByUser(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const iBanks = await BankModel.find({ createdBy: userId });
      const banks = iBanks.map(iBank => iBank.toBank());

      res.json(banks);
    } catch (err) {
      res
        .status(500)
        .json({ error: 'Failed to fetch banks', err: JSON.stringify(err) });
    }
  }
}
