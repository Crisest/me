import express, { Router } from 'express';
import { z } from 'zod';
import { getTransactionInsights } from './transaction.insights.controller';
import { authMiddleware } from '../auth';
import { validateQuery } from '../../middleware/validateRequest';
import { resolveBudgetScope } from '../../middleware/resolveBudgetScope';

const router: Router = express.Router();

const insightsQuery = z.object({
  year: z.coerce.number().int().optional(),
  scope: z.enum(['mine', 'household']).optional().default('mine'),
});

/**
 * @route GET /api/transactions/insights/:month
 * @description Get transaction insights for a specific month
 * @param {number} month - Month number (1-12)
 * @query {number} year - Optional year parameter
 * @query {string} scope - 'mine' (default) or 'household'
 * @access Private
 */
router.get(
  '/insights/:month',
  authMiddleware,
  validateQuery(insightsQuery),
  resolveBudgetScope,
  getTransactionInsights
);

export default router;
