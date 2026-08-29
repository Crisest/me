import { MongoClient, Db } from 'mongodb';
import { getConfig } from '../../config/env';

let client: MongoClient | null = null;

/**
 * Opens the source database with the raw driver — NOT through Mongoose.
 * Mongoose applies schema filtering, which would hide exactly the anomalies
 * the audit exists to find (unknown fields, wrong BSON types).
 *
 * readPreference=secondaryPreferred and no write API is used anywhere in the
 * ETL: the source is never modified.
 */
export const openMongo = async (): Promise<Db> => {
  client = new MongoClient(getConfig().mongoUri, {
    readPreference: 'secondaryPreferred',
  });
  await client.connect();
  return client.db();
};

export const closeMongo = async (): Promise<void> => {
  await client?.close();
  client = null;
};

export const COLLECTIONS = [
  'users',
  'banks',
  'cards',
  'accounts',
  'budgetcategories',
  'budgets',
  'budgetoverrides',
  'budgetcategoryoverrides',
  'groups',
  'transactions',
  'uploads',
] as const;

/** Fields the target schema knows about, per collection. */
export const KNOWN_FIELDS: Record<string, string[]> = {
  users: ['_id', '__v', 'email', 'passwordHash', 'name', 'createdAt', 'groups'],
  banks: [
    '_id',
    '__v',
    'name',
    'createdBy',
    'isPlaidLinked',
    'plaidAccessToken',
    'plaidItemId',
    'plaidInstitutionId',
    'plaidSyncCursor',
    'plaidStatus',
    'createdAt',
    'updatedAt',
  ],
  cards: ['_id', '__v', 'name', 'bankId', 'createdBy', 'createdAt', 'updatedAt'],
  accounts: [
    '_id',
    '__v',
    'bankId',
    'plaidAccountId',
    'name',
    'officialName',
    'mask',
    'type',
    'subtype',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  budgetcategories: [
    '_id',
    '__v',
    'name',
    'kind',
    'plannedAmount',
    'color',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  budgets: ['_id', '__v', 'salary', 'createdBy', 'createdAt', 'updatedAt'],
  budgetoverrides: [
    '_id',
    '__v',
    'month',
    'year',
    'salary',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  budgetcategoryoverrides: [
    '_id',
    '__v',
    'categoryId',
    'month',
    'year',
    'plannedAmount',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  groups: [
    '_id',
    '__v',
    'name',
    'members',
    'createdBy',
    'inviteCode',
    'createdAt',
    'updatedAt',
  ],
  transactions: [
    '_id',
    '__v',
    'amount',
    'description',
    'category',
    'subDescription',
    'date',
    'groupId',
    'cardId',
    'accountId',
    'createdBy',
    'categoryId',
    'plaidTransactionId',
    'logoUrl',
    'categoryIconUrl',
    'createdAt',
    'updatedAt',
  ],
  uploads: [
    '_id',
    '__v',
    'fileName',
    'fileHash',
    'cardId',
    'transactionCount',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
};
