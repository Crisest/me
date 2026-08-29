import { eq } from 'drizzle-orm';
import { Card, CreateCardPayload } from '@portfolio/common';
import { db } from '../../db/client';
import { cards } from '../../db/schema';
import { toCard } from './card.mapper';

export async function createCard(
  userId: string,
  data: CreateCardPayload
): Promise<Card> {
  const [row] = await db
    .insert(cards)
    .values({ name: data.name, bankId: data.bankId, createdBy: userId })
    .returning();
  return toCard(row);
}

export async function getCardsByUser(userId: string): Promise<Card[]> {
  const rows = await db
    .select()
    .from(cards)
    .where(eq(cards.createdBy, userId));
  return rows.map(toCard);
}
