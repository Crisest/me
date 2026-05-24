import { Router } from 'express';
import { body, query } from 'express-validator';
import * as budgetController from './budget.controller';
import { authMiddleware } from '../auth';
import { validateRequest } from '../../middleware/validateRequest';

const router: Router = Router();

const upsertValidation = [
  body('salary')
    .isNumeric()
    .custom(v => v > 0)
    .withMessage('salary must be a positive number'),
  body('fixedExpenses').isArray(),
  body('fixedExpenses.*.name').isString().notEmpty(),
  body('fixedExpenses.*.amount')
    .isNumeric()
    .custom(v => v > 0)
    .withMessage('amount must be a positive number'),
];

const getOverrideValidation = [
  query('month').isInt({ min: 1, max: 12 }),
  query('year').isInt({ min: 1970 }),
];

const upsertOverrideValidation = [
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 1970 }),
  body('salary')
    .isNumeric()
    .custom(v => v > 0)
    .withMessage('salary must be a positive number'),
];

router.get(
  '/override',
  authMiddleware,
  validateRequest(getOverrideValidation),
  budgetController.getOverride
);
router.put(
  '/override',
  authMiddleware,
  validateRequest(upsertOverrideValidation),
  budgetController.putOverride
);

router.get('/', authMiddleware, budgetController.getBudget);
router.put(
  '/',
  authMiddleware,
  validateRequest(upsertValidation),
  budgetController.putBudget
);

export default router;
