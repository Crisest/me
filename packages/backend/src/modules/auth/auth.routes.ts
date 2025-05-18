// modules/auth/auth.routes.ts
import { Router } from 'express';
import * as AuthController from './auth.controller';
import authMiddleware from './auth.middleware';
import { withAuth } from '@/utils/withAuth';

const router: Router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', authMiddleware, withAuth(AuthController.me));

export default router;
