import { Router } from 'express';
import { z } from 'zod';
import * as budgetController from './budget.controller';
import categoryRouter from './budgetCategory.routes';
import { authMiddleware } from '../auth';
import { validateQuery, validateBody } from '../../middleware/validateRequest';

const router: Router = Router();

const upsertBudgetBody = z.object({
  salary: z.number().gt(0, { message: 'salary must be a positive number' }),
});

const getOverrideQuery = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1970),
});

const upsertOverrideBody = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1970),
  salary: z.number().gt(0, { message: 'salary must be a positive number' }),
});

router.get(
  '/override',
  authMiddleware,
  validateQuery(getOverrideQuery),
  budgetController.getOverride
);
router.put(
  '/override',
  authMiddleware,
  validateBody(upsertOverrideBody),
  budgetController.putOverride
);

router.use(categoryRouter);

router.get('/', authMiddleware, budgetController.getBudget);
router.put(
  '/',
  authMiddleware,
  validateBody(upsertBudgetBody),
  budgetController.putBudget
);

export default router;
