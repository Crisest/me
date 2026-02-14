import { Request, Response } from 'express';
import { CardService } from './card.service';
import { CreateCardPayload } from '@portfolio/common';
import mongoose from 'mongoose';

export class CardController {
  static async createCard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const cardData: CreateCardPayload = req.body;
      const card = await CardService.createCard(userId, cardData);
      res.status(201).json(card);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create a card', message: e });
    }
  }

  static async getCardsByUser(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const cards = await CardService.getCardsByUser(userId);
      res.json(cards);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch cards', message: e });
    }
  }
}
