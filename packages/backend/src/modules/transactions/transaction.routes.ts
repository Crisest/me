import { Router } from 'express';
import { z } from 'zod';
import * as controller from './transaction.controller';
import { authMiddleware } from '../auth';
import { validateBody, validateParams } from '../../middleware/validateRequest';
import insightsRouter from './transaction.insights.routes';

const router: Router = Router();

const bulkCreateBody = z.object({
  transactions: z
    .array(z.any())
    .min(1, { message: 'transactions must be a non-empty array' }),
  cardId: z.string().min(1, { message: 'cardId is required' }),
  fileName: z.string().min(1, { message: 'fileName is required' }),
  fileHash: z.string().min(1, { message: 'fileHash is required' }),
});

const idParam = z.object({
  id: z.string().uuid({ message: 'id must be a valid id' }),
});

const setCategoryBody = z.object({
  categoryId: z
    .string()
    .uuid({ message: 'categoryId must be a valid id or null' })
    .nullable()
    .optional(),
});

router.get('/', authMiddleware, controller.getTransactionsByUserId);
router.post(
  '/bulk',
  authMiddleware,
  validateBody(bulkCreateBody),
  controller.postManyTransactionsByUser
);
router.patch(
  '/:id/category',
  authMiddleware,
  validateParams(idParam),
  validateBody(setCategoryBody),
  controller.setCategory
);
router.use(insightsRouter);

export default router;
