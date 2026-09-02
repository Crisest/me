import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as controller from './categorization.controller';
import { authMiddleware } from '../auth';
import { validateBody, validateQuery } from '../../middleware/validateRequest';
import { resolveBudgetScope } from '../../middleware/resolveBudgetScope';

const router: Router = Router();

const monthBody = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(1970),
});

const monthQuery = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1970),
});

const resolveBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid({ message: 'id must be a valid id' }),
        action: z.enum(['accept', 'reject']),
        categoryId: z.string().uuid().optional(),
      })
    )
    .min(1, { message: 'items must be a non-empty array' })
    .max(200, { message: 'items must contain at most 200 entries' }),
});

// The only endpoint in the app that spends money per call.
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many suggestion runs. Try again in a few minutes.',
});

router.post(
  '/suggestions',
  authMiddleware,
  generateLimiter,
  validateBody(monthBody),
  resolveBudgetScope,
  controller.generate
);

router.get(
  '/suggestions',
  authMiddleware,
  validateQuery(monthQuery),
  resolveBudgetScope,
  controller.list
);

router.post(
  '/suggestions/resolve',
  authMiddleware,
  validateBody(resolveBody),
  resolveBudgetScope,
  controller.resolve
);

export default router;
