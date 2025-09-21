import { Request, Response } from 'express';
import { CreateBankPayload } from '@portfolio/common';
import { createBank, getBanksByUser } from './bank.service';
import mongoose from 'mongoose';
import { Bank } from './bank.model';

export class BankController {
  static async createBank(req: Request, res: Response) {
    const userId = req.user!._id as mongoose.Types.ObjectId;
    const bankData: CreateBankPayload = req.body;

    const bank = await createBank(userId, bankData);
    res.status(201).json(bank);
  }

  static async getBanksByUser(req: Request, res: Response) {
    try {
      const userId = req.user!._id as mongoose.Types.ObjectId;

      const iBanks = await Bank.find({ createdBy: userId });
      const banks = iBanks.map(iBank => iBank.toBank());

      res.json(banks);
    } catch (err) {
      res
        .status(500)
        .json({ error: 'Failed to fetch banks', err: JSON.stringify(err) });
    }
  }
}
