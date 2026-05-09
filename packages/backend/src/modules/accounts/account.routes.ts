import { Router } from 'express';
import { authMiddleware } from '../auth';
import { listAccountsHandler } from './account.controller';

const router: Router = Router();

router.get('/', authMiddleware, listAccountsHandler);

export default router;
