import { and, eq } from 'drizzle-orm';
import { Bank, CreateBankPayload } from '@portfolio/common';
import { db } from '../../db/client';
import { banks, type BankRow } from '../../db/schema';
import { toBank } from './bank.mapper';

export async function createBank(
  userId: string,
  data: CreateBankPayload
): Promise<Bank> {
  const [row] = await db
    .insert(banks)
    .values({ name: data.name, createdBy: userId })
    .returning();
  return toBank(row);
}

export async function getBanksByUser(userId: string): Promise<Bank[]> {
  const rows = await db
    .select()
    .from(banks)
    .where(eq(banks.createdBy, userId));
  return rows.map(toBank);
}

/**
 * Returns the raw row, not the DTO — the Plaid module needs
 * plaidAccessToken and plaidSyncCursor, which toBank() strips.
 */
export async function findPlaidBankByIdForUser(
  userId: string,
  bankId: string
): Promise<BankRow | undefined> {
  return db.query.banks.findFirst({
    where: and(
      eq(banks.id, bankId),
      eq(banks.createdBy, userId),
      eq(banks.isPlaidLinked, true)
    ),
  });
}

export async function findPlaidLinkedBanksByUser(
  userId: string
): Promise<BankRow[]> {
  return db
    .select()
    .from(banks)
    .where(and(eq(banks.createdBy, userId), eq(banks.isPlaidLinked, true)));
}
