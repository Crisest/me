import { requireGroupMembership } from './group.middleware';
import { AppError } from '../../middleware/errorHandler';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser, makeGroup } from '../../../test/helpers/factories';
import { db } from '../../db/client';
import { groupMembers } from '../../db/schema';

afterEach(truncateAll);
afterAll(closeTestDb);

const buildCtx = (groupId: string, userId: string) => {
  const req: any = { params: { groupId }, user: { id: userId } };
  const res: any = { locals: {} };
  const next = jest.fn();
  return { req, res, next };
};

it('calls next with no error and stashes the group for a member', async () => {
  const owner = await makeUser();
  const group = await makeGroup(owner.id);
  await db.insert(groupMembers).values({ groupId: group.id, userId: owner.id });
  const { req, res, next } = buildCtx(group.id, owner.id);

  await requireGroupMembership(req, res, next);

  expect(next).toHaveBeenCalledWith();
  expect(res.locals.group).toEqual({ id: group.id, members: [owner.id] });
});

it('rejects a non-member with 403', async () => {
  const owner = await makeUser();
  const outsider = await makeUser();
  const group = await makeGroup(owner.id);
  await db.insert(groupMembers).values({ groupId: group.id, userId: owner.id });
  const { req, res, next } = buildCtx(group.id, outsider.id);

  await requireGroupMembership(req, res, next);

  const err = next.mock.calls[0][0] as AppError;
  expect(err).toBeInstanceOf(AppError);
  expect(err.statusCode).toBe(403);
  expect(res.locals.group).toBeUndefined();
});

it('rejects an unknown group with 404', async () => {
  const owner = await makeUser();
  const { req, res, next } = buildCtx('00000000-0000-0000-0000-000000000000', owner.id);

  await requireGroupMembership(req, res, next);

  const err = next.mock.calls[0][0] as AppError;
  expect(err.statusCode).toBe(404);
});
