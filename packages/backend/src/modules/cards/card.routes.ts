import { Router } from 'express';
import { createCardHandler, getCardsByUserHandler } from './card.controller';
import { authMiddleware } from '../auth';
import { validateBody } from '../../middleware/validateRequest';
import { createCardSchema } from './card.validation';

const router: Router = Router();

router.post(
  '/',
  authMiddleware,
  validateBody(createCardSchema),
  createCardHandler
);
router.get('/', authMiddleware, getCardsByUserHandler);

export default router;
