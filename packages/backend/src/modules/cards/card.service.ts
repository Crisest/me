import { Card } from './card.model';
import mongoose from 'mongoose';
import { CreateCardPayload } from '@portfolio/common';

export class CardService {
  static async createCard(userId: string, data: CreateCardPayload) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const cardData = Card.fromCommonCard(data, userObjectId);
    const card = await Card.create(cardData);
    return card.toCard();
  }

  static async getCardsByUser(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const cards = await Card.find({ createdBy: userObjectId });
    return cards.map(card => card.toCard());
  }
}
