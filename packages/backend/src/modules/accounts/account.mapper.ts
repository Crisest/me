import type { Account } from '@portfolio/common';
import type { AccountRow } from '../../db/schema';

export const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  bankId: row.bankId,
  plaidAccountId: row.plaidAccountId,
  name: row.name,
  officialName: row.officialName ?? undefined,
  mask: row.mask ?? undefined,
  type: row.type,
  subtype: row.subtype ?? undefined,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt ?? undefined,
});
