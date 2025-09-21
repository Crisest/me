import { Router } from 'express';
import { BankController } from './bank.controller';
import { authMiddleware } from '../auth/auth.middleware';

const router: Router = Router();

router.post('/', authMiddleware, BankController.createBank);
router.get('/', authMiddleware, BankController.getBanksByUser);

export default router;
