import { Router } from 'express';
import { authMiddleware } from '../auth';
import { validateBody } from '../../middleware/validateRequest';
import {
  createAccountHandler,
  listAccountsHandler,
} from './account.controller';
import { createAccountSchema } from './account.validation';

const router: Router = Router();

router.get('/', authMiddleware, listAccountsHandler);
router.post(
  '/',
  authMiddleware,
  validateBody(createAccountSchema),
  createAccountHandler
);

export default router;
