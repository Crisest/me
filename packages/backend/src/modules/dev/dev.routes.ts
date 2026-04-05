import { Router } from 'express';
import { authMiddleware } from '../auth';
import * as controller from './dev.controller';

const router: Router = Router();

router.delete('/reset', authMiddleware, controller.resetUserData);

export default router;
