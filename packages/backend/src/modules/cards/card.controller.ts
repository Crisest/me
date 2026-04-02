import { Request, Response } from 'express';
import { CreateCardPayload } from '@portfolio/common';
import { createCard, getCardsByUser } from './card.service';

export const createCardHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const cardData: CreateCardPayload = req.body;
    const card = await createCard(userId, cardData);
    res.status(201).json(card);
  } catch (err) {
    req.log.error({ err }, 'Failed to create a card');
    res.status(500).json({ error: 'Failed to create a card' });
  }
};

export const getCardsByUserHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const cards = await getCardsByUser(userId);
    res.json(cards);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch cards');
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
};
