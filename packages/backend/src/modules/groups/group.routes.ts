import { Router } from 'express';
import { body } from 'express-validator';
import * as controller from './group.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';

const router: Router = Router();

const createGroupValidation = [
  body('name').isString().notEmpty().withMessage('name is required'),
];

const addMemberValidation = [
  body('userId').isString().notEmpty().withMessage('userId is required'),
];

// Group CRUD
router.post('/', authMiddleware, validateRequest(createGroupValidation), controller.createGroup);
router.get('/', authMiddleware, controller.getGroups);

// Member management
router.post('/:groupId/members', authMiddleware, validateRequest(addMemberValidation), controller.addMember);
router.delete('/:groupId/members', authMiddleware, validateRequest(addMemberValidation), controller.removeMember);

// Group transactions & insights
router.get('/:groupId/transactions', authMiddleware, controller.getGroupTransactions);
router.get('/:groupId/insights/:month', authMiddleware, controller.getGroupInsights);

export default router;
