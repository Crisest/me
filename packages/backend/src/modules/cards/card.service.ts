import { CardModel } from './card.model';
import { CreateCardPayload } from '@portfolio/common';

export class CardService {
  static async createCard(userId: string, data: CreateCardPayload) {
    const cardData = CardModel.fromCreatePayload(data, userId);
    const card = await CardModel.create(cardData);
    return card.toCard();
  }

  static async getCardsByUser(userId: string) {
    const iCards = await CardModel.find({ createdBy: userId });
    return iCards.map(iCard => iCard.toCard());
  }
}
