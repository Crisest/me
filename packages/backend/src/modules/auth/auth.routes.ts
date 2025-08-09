// modules/auth/auth.routes.ts
import { Router } from 'express';
import * as AuthController from './auth.controller';
import { authMiddleware } from './auth.middleware';

const router: Router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', authMiddleware, AuthController.me);

export default router;
