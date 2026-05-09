import { Router } from 'express';
import { body, param } from 'express-validator';
import { authMiddleware } from '../auth';
import { validateRequest } from '../../middleware/validateRequest';
import {
  createLinkTokenHandler,
  exchangeTokenHandler,
  syncAllHandler,
  syncOneHandler,
  unlinkBankHandler,
  updateLinkTokenHandler,
  resyncBankHandler,
} from './plaid.controller';

const router: Router = Router();

const exchangeValidation = [
  body('publicToken').isString().notEmpty().withMessage('publicToken is required'),
  body('institutionId').isString().notEmpty().withMessage('institutionId is required'),
  body('institutionName').isString().notEmpty().isLength({ max: 200 }).withMessage('institutionName is required'),
];

const bankIdValidation = [
  param('bankId').isMongoId().withMessage('bankId must be a valid id'),
];

router.post('/link-token', authMiddleware, createLinkTokenHandler);
router.post(
  '/exchange-token',
  authMiddleware,
  validateRequest(exchangeValidation),
  exchangeTokenHandler
);

router.post('/sync', authMiddleware, syncAllHandler);
router.post('/sync/:bankId', authMiddleware, validateRequest(bankIdValidation), syncOneHandler);
router.post(
  '/resync/:bankId',
  authMiddleware,
  validateRequest(bankIdValidation),
  resyncBankHandler
);

router.delete('/bank/:bankId', authMiddleware, validateRequest(bankIdValidation), unlinkBankHandler);

router.post('/link-token/update/:bankId', authMiddleware, validateRequest(bankIdValidation), updateLinkTokenHandler);

export default router;
