import { Router } from 'express';
import { z } from 'zod';
import * as controller from './household.controller';
import { authMiddleware } from '../auth';
import { requireHouseholdMembership } from './household.middleware';
import { validateBody, validateParams } from '../../middleware/validateRequest';

const router: Router = Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const createSchema = z.object({ name: z.string().trim().min(1) });
const renameSchema = z.object({ name: z.string().trim().min(1) });
const joinSchema = z.object({ code: z.string().trim().min(1) });
const removeMemberSchema = z.object({ userId: z.string().uuid() });

router.post(
  '/',
  authMiddleware,
  validateBody(createSchema),
  controller.postHousehold
);

router.get('/', authMiddleware, controller.getHouseholds);

router.post(
  '/join',
  authMiddleware,
  validateBody(joinSchema),
  controller.postJoin
);

router.patch(
  '/:id',
  authMiddleware,
  validateParams(idParamsSchema),
  requireHouseholdMembership,
  validateBody(renameSchema),
  controller.patchHousehold
);

router.post(
  '/:id/leave',
  authMiddleware,
  validateParams(idParamsSchema),
  requireHouseholdMembership,
  controller.postLeave
);

router.post(
  '/:id/invite-code',
  authMiddleware,
  validateParams(idParamsSchema),
  requireHouseholdMembership,
  controller.postInviteCode
);

router.delete(
  '/:id/members',
  authMiddleware,
  validateParams(idParamsSchema),
  requireHouseholdMembership,
  validateBody(removeMemberSchema),
  controller.deleteMember
);

export default router;
