import { Request, Response } from 'express';
import { CardService } from './card.service';
import { CreateCardPayload } from '@portfolio/common';
import mongoose from 'mongoose';

export class CardController {
  static async createCard(req: Request, res: Response) {
    const userId = req.user!._id as mongoose.Types.ObjectId;
    const cardData: CreateCardPayload = req.body;

    const card = await CardService.createCard(userId, cardData);
    res.status(201).json(card);
  }

  static async getCardsByUser(req: Request, res: Response) {
    const userId = req.user!._id as mongoose.Types.ObjectId;
    const cards = await CardService.getCardsByUser(userId);
    res.json(cards);
  }
}
