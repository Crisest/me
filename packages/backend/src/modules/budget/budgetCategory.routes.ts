import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as controller from './budgetCategory.controller';
import { authMiddleware } from '../auth';
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

const overrideValidation = [
  ...idParam,
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 1970 }),
  body('plannedAmount')
    .isNumeric()
    .custom(v => v > 0)
    .withMessage('plannedAmount must be a positive number'),
];

router.get('/summary', authMiddleware, validateRequest(monthYearQuery), controller.getSummary);

router.get('/categories', authMiddleware, controller.getCategories);
router.post(
  '/categories',
  authMiddleware,
  validateBody(createCategorySchema),
  controller.postCategory
);
router.patch(
  '/categories/:id',
  authMiddleware,
  validateRequest(idParam),
  validateBody(updateCategorySchema),
  controller.patchCategory
);
router.delete('/categories/:id', authMiddleware, validateRequest(idParam), controller.deleteCategory);

router.put(
  '/categories/:id/override',
  authMiddleware,
  validateRequest(overrideValidation),
  controller.putCategoryOverride
);
router.delete(
  '/categories/:id/override',
  authMiddleware,
  validateRequest([...idParam, ...monthYearQuery]),
  controller.deleteCategoryOverride
);

export default router;
