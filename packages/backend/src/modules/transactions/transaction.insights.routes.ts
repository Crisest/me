import express, { Router } from 'express';
import { getTransactionInsights } from './transaction.insights.controller';
import { authMiddleware } from '../auth';

const router: Router = express.Router();

/**
 * @route GET /api/transactions/insights/:month
 * @description Get transaction insights for a specific month
 * @param {number} month - Month number (1-12)
 * @query {number} year - Optional year parameter
 * @access Private
 */
router.get('/insights/:month', authMiddleware, getTransactionInsights);

export default router;
