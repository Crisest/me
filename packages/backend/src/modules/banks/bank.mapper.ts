import type { Bank } from '@portfolio/common';
import type { BankRow } from '../../db/schema';

/** Never returns plaidAccessToken or plaidSyncCursor — those stay server-side. */
export const toBank = (row: BankRow): Bank => ({
  id: row.id,
  name: row.name,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt ?? undefined,
  isPlaidLinked: row.isPlaidLinked,
  plaidStatus: row.plaidStatus ?? undefined,
  plaidInstitutionId: row.plaidInstitutionId ?? undefined,
});
