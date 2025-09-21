import { Bank } from './bank.model';
import mongoose from 'mongoose';
import { CreateBankPayload } from '@portfolio/common';

export class BankService {
  static async createBank(userId: string, data: CreateBankPayload) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const bankData = Bank.fromCommonBank(data, userObjectId);
    const bank = await Bank.create(bankData);
    return bank.toBank();
  }

  static async getBanksByUser(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const banks = await Bank.find({ createdBy: userObjectId });
    return banks.map(bank => bank.toBank());
  }
}
