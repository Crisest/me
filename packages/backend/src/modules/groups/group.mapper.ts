import type { Group, GroupMember, GroupWithMembers } from '@portfolio/common';
import type { GroupRow } from '../../db/schema';

export const toGroup = (row: GroupRow, memberIds: string[]): Group => ({
  id: row.id,
  name: row.name,
  members: memberIds,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  inviteCode: row.inviteCode,
});

export const toGroupWithMembers = (
  row: GroupRow,
  members: GroupMember[]
): GroupWithMembers => ({
  id: row.id,
  name: row.name,
  members,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  inviteCode: row.inviteCode,
});
