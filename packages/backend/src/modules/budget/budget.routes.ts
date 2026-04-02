import { Router } from 'express';
import { body } from 'express-validator';
import * as budgetController from './budget.controller';
import { authMiddleware } from '../auth';
import { validateRequest } from '../../middleware/validateRequest';

const router: Router = Router();

const upsertValidation = [
  body('salary').isNumeric().custom(v => v > 0).withMessage('salary must be a positive number'),
  body('fixedExpenses').isArray(),
  body('fixedExpenses.*.name').isString().notEmpty(),
  body('fixedExpenses.*.amount').isNumeric().custom(v => v > 0).withMessage('amount must be a positive number'),
];

router.get('/', authMiddleware, budgetController.getBudget);
router.put('/', authMiddleware, validateRequest(upsertValidation), budgetController.putBudget);

export default router;
