import { Card } from './card.model';
import mongoose from 'mongoose';
import { CreateCardPayload } from '@portfolio/common';

export class CardService {
  static async createCard(
    userId: mongoose.Types.ObjectId,
    data: CreateCardPayload
  ) {
    const cardData = Card.fromCommonCard(data, userId);
    const card = await Card.create(cardData);
    return card.toCard();
  }

  static async getCardsByUser(userId: mongoose.Types.ObjectId) {
    const iCards = await Card.find({ createdBy: userId });
    return iCards.map(iCard => iCard.toCard());
  }
}
