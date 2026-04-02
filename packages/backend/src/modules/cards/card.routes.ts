import { Router } from 'express';
import { body } from 'express-validator';
import { createCardHandler, getCardsByUserHandler } from './card.controller';
import { authMiddleware } from '../auth';
import { validateRequest } from '../../middleware/validateRequest';

const router: Router = Router();

const createCardValidation = [
  body('name').isString().notEmpty().withMessage('name is required'),
];

router.post('/', authMiddleware, validateRequest(createCardValidation), createCardHandler);
router.get('/', authMiddleware, getCardsByUserHandler);

export default router;
