import mongoose from 'mongoose';
import { AccountsGetResponse } from 'plaid';
import { AccountModel, IAccount } from './account.model';
import { Account, AccountType } from '@portfolio/common';

type PlaidAccount = AccountsGetResponse['accounts'][number];

function normaliseType(t: string | null | undefined): AccountType {
  switch (t) {
    case 'depository':
    case 'credit':
    case 'loan':
    case 'investment':
      return t;
    default:
      return 'other';
  }
}

export async function upsertPlaidAccountsForBank(
  userId: string,
  bankId: string,
  plaidAccounts: PlaidAccount[]
): Promise<IAccount[]> {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const bankObjId = new mongoose.Types.ObjectId(bankId);

  const ops = plaidAccounts.map(a => ({
    updateOne: {
      filter: { plaidAccountId: a.account_id },
      update: {
        $set: {
          bankId: bankObjId,
          name: a.name,
          officialName: a.official_name ?? undefined,
          mask: a.mask ?? undefined,
          type: normaliseType(a.type),
          subtype: a.subtype ?? undefined,
        },
        $setOnInsert: {
          plaidAccountId: a.account_id,
          createdBy: userObjId,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await AccountModel.bulkWrite(ops, { ordered: false });
  }

  return AccountModel.find({ bankId: bankObjId, createdBy: userObjId });
}

export async function getAccountsByUser(userId: string): Promise<Account[]> {
  const docs = await AccountModel.find({ createdBy: userId });
  return docs.map(d => d.toAccount());
}

export async function findAccountByPlaidId(
  userId: string,
  plaidAccountId: string
): Promise<IAccount | null> {
  return AccountModel.findOne({ createdBy: userId, plaidAccountId });
}

export async function deleteAccountsForBank(bankId: string): Promise<void> {
  await AccountModel.deleteMany({ bankId: new mongoose.Types.ObjectId(bankId) });
}
