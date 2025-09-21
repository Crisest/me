import { Request, Response } from 'express';
import { CardService } from './card.service';
import { CreateCardPayload } from '@portfolio/common';

export class CardController {
  static async createCard(req: Request, res: Response) {
    const userId = req.user?.id;
    const cardData: CreateCardPayload = req.body;

    const card = await CardService.createCard(userId, cardData);
    res.status(201).json(card);
  }

  static async getCardsByUser(req: Request, res: Response) {
    const userId = req.user?.id;
    const cards = await CardService.getCardsByUser(userId);
    res.json(cards);
  }
}
