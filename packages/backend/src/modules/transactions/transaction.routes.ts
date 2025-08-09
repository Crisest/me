import { Router } from 'express';
import * as controller from './transaction.controller';
import { authMiddleware } from '../auth';

const router: Router = Router();

router.get('/', authMiddleware, controller.getTransactionsByUserId);
router.post('/', authMiddleware, controller.postTransactionByUser);
router.post('/bulk', authMiddleware, controller.postManyTransactionsByUser);

export default router;
