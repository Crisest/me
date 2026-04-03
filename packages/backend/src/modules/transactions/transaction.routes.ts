import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './transaction.controller';
import { authMiddleware } from '../auth';
import { validateRequest } from '../../middleware/validateRequest';
import insightsRouter from './transaction.insights.routes';

const router: Router = Router();

const bulkCreateValidation = [
  body('transactions').isArray({ min: 1 }).withMessage('transactions must be a non-empty array'),
  body('cardId').isString().notEmpty().withMessage('cardId is required'),
  body('bankId').isString().notEmpty().withMessage('bankId is required'),
];

router.get('/', authMiddleware, controller.getTransactionsByUserId);
router.post('/bulk', authMiddleware, validateRequest(bulkCreateValidation), controller.postManyTransactionsByUser);
router.use(insightsRouter);

export default router;
