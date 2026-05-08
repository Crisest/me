import mongoose from 'mongoose';
import { CountryCode, Products, Transaction as PlaidTransaction } from 'plaid';
import { getPlaidClient } from './plaid.client';
import { BankModel } from '../banks/bank.model';
import type { IBank } from '../banks/bank.model';
import { TransactionModel } from '../transactions/transaction.model';
import { encrypt, decrypt } from '@/utils/crypto';
import { PlaidPayloads, PlaidLinkedBank } from '@portfolio/common';
import { findPlaidLinkedBanksByUser, findPlaidBankByIdForUser } from '../banks/bank.service';

export async function createLinkToken(userId: string): Promise<string> {
  const plaid = getPlaidClient();
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Portfolio Finance',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us, CountryCode.Ca],
    language: 'en',
  });
  return response.data.link_token;
}

export async function exchangePublicToken(
  userId: string,
  payload: PlaidPayloads.ExchangeTokenRequest
): Promise<PlaidLinkedBank> {
  const plaid = getPlaidClient();
  const exchange = await plaid.itemPublicTokenExchange({
    public_token: payload.publicToken,
  });

  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const bank = await BankModel.create({
    name: payload.institutionName,
    createdBy: userId,
    isPlaidLinked: true,
    plaidAccessToken: encrypt(accessToken),
    plaidItemId: itemId,
    plaidInstitutionId: payload.institutionId,
    plaidStatus: 'connected',
  });

  return bank.toBank() as PlaidLinkedBank;
}

type SyncCounts = PlaidPayloads.SyncResponse;

function mapPlaidTxToDoc(tx: PlaidTransaction, userId: string) {
  return {
    amount: tx.amount,
    description: tx.merchant_name ?? tx.name,
    category: tx.personal_finance_category?.primary,
    subDescription: tx.personal_finance_category?.detailed,
    date: new Date(tx.date),
    plaidTransactionId: tx.transaction_id,
    createdBy: new mongoose.Types.ObjectId(userId),
  };
}

async function syncBank(bank: IBank): Promise<SyncCounts> {
  if (!bank.isPlaidLinked || !bank.plaidAccessToken) {
    throw new Error(`Bank ${bank._id} is not Plaid-linked`);
  }

  const plaid = getPlaidClient();
  const accessToken = decrypt(bank.plaidAccessToken);
  const userId = bank.createdBy.toString();

  let cursor = bank.plaidSyncCursor || undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await plaid.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      const data = response.data;

      const nonPendingAdded = data.added.filter(t => !t.pending);
      const nonPendingModified = data.modified.filter(t => !t.pending);

      if (nonPendingAdded.length > 0) {
        await TransactionModel.insertMany(
          nonPendingAdded.map(t => mapPlaidTxToDoc(t, userId)),
          { ordered: false }
        ).catch(err => {
          // Duplicate key (same plaidTransactionId seen twice) is safe to ignore
          if (err?.code !== 11000) throw err;
        });
        added += nonPendingAdded.length;
      }

      for (const t of nonPendingModified) {
        await TransactionModel.updateOne(
          { plaidTransactionId: t.transaction_id },
          { $set: mapPlaidTxToDoc(t, userId) },
          { upsert: true }
        );
        modified += 1;
      }

      if (data.removed.length > 0) {
        const ids = data.removed
          .map(r => r.transaction_id)
          .filter((id): id is string => !!id);
        const result = await TransactionModel.deleteMany({
          plaidTransactionId: { $in: ids },
          createdBy: bank.createdBy,
        });
        removed += result.deletedCount ?? 0;
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    bank.plaidSyncCursor = cursor;
    bank.plaidStatus = 'connected';
    await bank.save();

    return { added, modified, removed };
  } catch (err: any) {
    const plaidCode = err?.response?.data?.error_code;
    if (plaidCode === 'ITEM_LOGIN_REQUIRED') {
      bank.plaidStatus = 'login_required';
      await bank.save();
    } else {
      bank.plaidStatus = 'error';
      await bank.save();
    }
    throw err;
  }
}

export async function syncOneBankForUser(userId: string, bankId: string): Promise<SyncCounts> {
  const bank = await findPlaidBankByIdForUser(userId, bankId);
  if (!bank) throw new Error('Plaid-linked bank not found');
  return syncBank(bank);
}

export async function syncAllBanksForUser(userId: string): Promise<SyncCounts> {
  const banks = await findPlaidLinkedBanksByUser(userId);
  const totals: SyncCounts = { added: 0, modified: 0, removed: 0 };
  for (const bank of banks) {
    try {
      const r = await syncBank(bank);
      totals.added += r.added;
      totals.modified += r.modified;
      totals.removed += r.removed;
    } catch {
      // Per-bank failure already updated plaidStatus; continue with others
    }
  }
  return totals;
}

export async function createUpdateLinkToken(userId: string, bankId: string): Promise<string> {
  const bank = await findPlaidBankByIdForUser(userId, bankId);
  if (!bank) throw new Error('Plaid-linked bank not found');

  const plaid = getPlaidClient();
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Portfolio Finance',
    country_codes: [CountryCode.Us, CountryCode.Ca],
    language: 'en',
    access_token: decrypt(bank.plaidAccessToken!),
  });
  return response.data.link_token;
}

export async function unlinkBank(userId: string, bankId: string): Promise<void> {
  const bank = await findPlaidBankByIdForUser(userId, bankId);
  if (!bank) throw new Error('Plaid-linked bank not found');

  try {
    const plaid = getPlaidClient();
    await plaid.itemRemove({ access_token: decrypt(bank.plaidAccessToken!) });
  } catch {
    // If Plaid call fails we still locally unlink — avoids orphaned local state
  }

  bank.isPlaidLinked = false;
  bank.plaidAccessToken = undefined;
  bank.plaidItemId = undefined;
  bank.plaidInstitutionId = undefined;
  bank.plaidSyncCursor = undefined;
  bank.plaidStatus = undefined;
  await bank.save();
}
