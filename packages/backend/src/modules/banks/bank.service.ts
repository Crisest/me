import { Bank } from './bank.model';
import { CreateBankPayload } from '@portfolio/common';

export async function createBank(userId: string, data: CreateBankPayload) {
  const iBank = Bank.fromCommonBank(data, userId);
  const bank = await Bank.create(iBank);
  return bank.toBank();
}

export async function getBanksByUser(userId: string) {
  const iBanks = await Bank.find({ createdBy: userId });
  const banks = iBanks.map(iBank => iBank.toBank());
  return banks || [];
}
