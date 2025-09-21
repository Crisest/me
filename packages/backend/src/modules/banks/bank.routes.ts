import { Router } from 'express';
import { BankController } from './bank.controller';
import { withAuth } from '../../utils/withAuth';

const router: Router = Router();

router.post('/', withAuth, BankController.createBank);
router.get('/', withAuth, BankController.getBanksByUser);

export default router;
