import { Router } from 'express';
import { body } from 'express-validator';
import { createBankHandler, getBanksByUserHandler } from './bank.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';

const router: Router = Router();

const createBankValidation = [
  body('name').isString().notEmpty().withMessage('name is required'),
];

router.post(
  '/',
  authMiddleware,
  validateRequest(createBankValidation),
  createBankHandler
);
router.get('/', authMiddleware, getBanksByUserHandler);

export default router;
