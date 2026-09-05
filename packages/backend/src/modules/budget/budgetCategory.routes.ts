import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as controller from './budgetCategory.controller';
import { authMiddleware } from '../auth';
import { resolveBudgetScope } from '../../middleware/resolveBudgetScope';
import { validateRequest, validateBody } from '../../middleware/validateRequest';
import {
  createCategorySchema,
  updateCategorySchema,
} from './budgetCategory.validation';

const router: Router = Router();

const idParam = [param('id').isUUID().withMessage('id must be a valid id')];

const monthYearQuery = [
  query('month').isInt({ min: 1, max: 12 }),
  query('year').isInt({ min: 1970 }),
];

const scopeQuery = [query('scope').optional().isIn(['mine', 'household'])];

const overrideValidation = [
  ...idParam,
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 1970 }),
  body('plannedAmount')
    .isNumeric()
    .custom(v => v > 0)
    .withMessage('plannedAmount must be a positive number'),
];

router.get(
  '/summary',
  authMiddleware,
  resolveBudgetScope,
  validateRequest([...monthYearQuery, ...scopeQuery]),
  controller.getSummary
);

router.get('/categories', authMiddleware, resolveBudgetScope, controller.getCategories);
router.post(
  '/categories',
  authMiddleware,
  resolveBudgetScope,
  validateBody(createCategorySchema),
  controller.postCategory
);
router.patch(
  '/categories/:id',
  authMiddleware,
  resolveBudgetScope,
  validateRequest(idParam),
  validateBody(updateCategorySchema),
  controller.patchCategory
);
router.delete(
  '/categories/:id',
  authMiddleware,
  resolveBudgetScope,
  validateRequest(idParam),
  controller.deleteCategory
);

router.put(
  '/categories/:id/override',
  authMiddleware,
  resolveBudgetScope,
  validateRequest(overrideValidation),
  controller.putCategoryOverride
);
router.delete(
  '/categories/:id/override',
  authMiddleware,
  resolveBudgetScope,
  validateRequest([...idParam, ...monthYearQuery]),
  controller.deleteCategoryOverride
);

export default router;
