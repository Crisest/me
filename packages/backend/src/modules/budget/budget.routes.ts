import { Router } from 'express';
import * as budgetController from './budget.controller';
import * as fixedExpenseController from './fixedExpense.controller';
import { authMiddleware } from '../auth';

const router: Router = Router();

// FixedExpense routes
router.get(
  '/fixed-expenses',
  authMiddleware,
  fixedExpenseController.getFixedExpensesByUserId
);
router.get(
  '/fixed-expenses/:id',
  authMiddleware,
  fixedExpenseController.getFixedExpenseById
);
router.post(
  '/fixed-expenses',
  authMiddleware,
  fixedExpenseController.postFixedExpense
);
router.put(
  '/fixed-expenses/:id',
  authMiddleware,
  fixedExpenseController.putFixedExpense
);
router.delete(
  '/fixed-expenses/:id',
  authMiddleware,
  fixedExpenseController.deleteFixedExpense
);

// Budget routes
router.get('/', authMiddleware, budgetController.getBudget);
router.put('/', authMiddleware, budgetController.putBudget);

export default router;
