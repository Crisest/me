// modules/auth/auth.routes.ts
import { Router } from 'express';
import * as AuthController from './auth.controller';
import { authMiddleware } from './auth.middleware';
import { authLimiter } from '../../middleware/rateLimiter';
import { validateBody } from '../../middleware/validateRequest';
import { loginSchema, registerSchema } from './auth.validation';

const router: Router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), AuthController.register);
router.post('/login', authLimiter, validateBody(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', authMiddleware, AuthController.me);

export default router;
