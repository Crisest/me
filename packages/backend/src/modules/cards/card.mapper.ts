import type { Card } from '@portfolio/common';
import type { CardRow } from '../../db/schema';

export const toCard = (row: CardRow): Card => ({
  id: row.id,
  name: row.name,
  bankId: row.bankId,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt ?? undefined,
});
