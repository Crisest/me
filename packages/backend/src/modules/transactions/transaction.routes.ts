import { Router } from 'express';
import {
  getTransactionsByUserId,
  postTransactionByUser,
} from './transaction.controller';
import authMiddleware from '../auth';
import { withAuth } from '@/utils/withAuth';

const router = Router();

router.get('/', authMiddleware, withAuth(getTransactionsByUserId));
router.post('/', authMiddleware, withAuth(postTransactionByUser));

export default router;
