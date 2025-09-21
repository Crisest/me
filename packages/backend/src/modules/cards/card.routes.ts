import { Router } from 'express';
import { CardController } from './card.controller';
import { withAuth } from '../../utils/withAuth';

const router: Router = Router();

router.post('/', withAuth, CardController.createCard);
router.get('/', withAuth, CardController.getCardsByUser);

export default router;
