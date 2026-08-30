import type { Household, HouseholdMember } from '@portfolio/common';
import type { HouseholdRow } from '../../db/schema';

export const toHousehold = (
  row: HouseholdRow,
  members: HouseholdMember[]
): Household => ({
  id: row.id,
  name: row.name,
  inviteCode: row.inviteCode,
  archived: row.archived,
  createdBy: row.createdBy ?? undefined,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  members,
});
