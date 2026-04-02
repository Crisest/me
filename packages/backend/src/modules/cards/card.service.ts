import { CardModel } from './card.model';
import { CreateCardPayload } from '@portfolio/common';

export async function createCard(userId: string, data: CreateCardPayload) {
  const cardData = CardModel.fromCreatePayload(data, userId);
  const card = await CardModel.create(cardData);
  return card.toCard();
}

export async function getCardsByUser(userId: string) {
  const iCards = await CardModel.find({ createdBy: userId });
  return iCards.map(iCard => iCard.toCard());
}
