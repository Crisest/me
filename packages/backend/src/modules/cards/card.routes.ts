import { Router } from 'express';
import { CardController } from './card.controller';
import { authMiddleware } from '../auth';

const router: Router = Router();

router.post('/', authMiddleware, CardController.createCard);
router.get('/', authMiddleware, CardController.getCardsByUser);

export default router;
