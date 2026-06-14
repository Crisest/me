import mongoose from 'mongoose';
import { User } from '../../src/modules/users/user.model';
import { BankModel } from '../../src/modules/banks/bank.model';
import { CardModel } from '../../src/modules/cards/card.model';
import { TransactionModel } from '../../src/modules/transactions/transaction.model';

let counter = 0;
const uniq = () => ++counter;

export async function makeUser(overrides: Partial<{ email: string; name: string; passwordHash: string }> = {}) {
  const n = uniq();
  const user = await User.create({
    email: overrides.email ?? `user${n}@test.local`,
    name: overrides.name ?? `User ${n}`,
    passwordHash: overrides.passwordHash ?? 'hashed-password-placeholder',
  });
  return user;
}

export async function makeBank(userId: string, overrides: Partial<{ name: string }> = {}) {
  const n = uniq();
  return BankModel.create({
    name: overrides.name ?? `Bank ${n}`,
    createdBy: new mongoose.Types.ObjectId(userId),
    isPlaidLinked: false,
  });
}

export async function makeCard(userId: string, bankId: string, overrides: Partial<{ name: string }> = {}) {
  const n = uniq();
  return CardModel.create({
    name: overrides.name ?? `Card ${n}`,
    bankId: new mongoose.Types.ObjectId(bankId),
    createdBy: new mongoose.Types.ObjectId(userId),
  });
}

export async function makeTransaction(
  userId: string,
  cardId: string,
  overrides: Partial<{ amount: number; description: string; date: Date; fixedExpenseId: mongoose.Types.ObjectId }> = {}
) {
  const n = uniq();
  return TransactionModel.create({
    amount: overrides.amount ?? 12.34,
    description: overrides.description ?? `Tx ${n}`,
    date: overrides.date ?? new Date('2026-05-10'),
    cardId: new mongoose.Types.ObjectId(cardId),
    createdBy: new mongoose.Types.ObjectId(userId),
    fixedExpenseId: overrides.fixedExpenseId,
  });
}
