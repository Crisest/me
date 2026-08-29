import { Router } from 'express';
import { createBankHandler, getBanksByUserHandler } from './bank.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../middleware/validateRequest';
import { createBankSchema } from './bank.validation';

const router: Router = Router();

router.post(
  '/',
  authMiddleware,
  validateBody(createBankSchema),
  createBankHandler
);
router.get('/', authMiddleware, getBanksByUserHandler);

export default router;
