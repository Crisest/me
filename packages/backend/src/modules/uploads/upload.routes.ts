import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../auth';
import { validateRequest } from '../../middleware/validateRequest';
import * as controller from './upload.controller';

const router: Router = Router();

const checkDuplicateValidation = [
  body('fileName').isString().notEmpty().withMessage('fileName is required'),
  body('fileHash').isString().notEmpty().withMessage('fileHash is required'),
  body('cardId').isString().notEmpty().withMessage('cardId is required'),
];

router.post(
  '/check-duplicate',
  authMiddleware,
  validateRequest(checkDuplicateValidation),
  controller.checkDuplicateHandler
);

export default router;
