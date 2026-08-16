import mongoose from 'mongoose';
import { requireGroupMembership } from './group.middleware';
import { Group } from './group.model';
import { AppError } from '../../middleware/errorHandler';

jest.mock('./group.model');

const mockedGroup = Group as unknown as jest.Mocked<typeof Group>;

const MEMBER_A = new mongoose.Types.ObjectId();
const OUTSIDER = new mongoose.Types.ObjectId();
const GROUP_ID = new mongoose.Types.ObjectId().toString();

const buildCtx = (userId: string) => {
  const req: any = { params: { groupId: GROUP_ID }, user: { id: userId } };
  const res: any = { locals: {} };
  const next = jest.fn();
  return { req, res, next };
};

beforeEach(() => jest.clearAllMocks());

it('calls next with no error and stashes the group for a member', async () => {
  const group = { members: [MEMBER_A] };
  mockedGroup.findById = jest.fn().mockResolvedValue(group) as any;
  const { req, res, next } = buildCtx(MEMBER_A.toString());

  await requireGroupMembership(req, res, next);

  expect(next).toHaveBeenCalledWith();
  expect(res.locals.group).toBe(group);
});

it('rejects a non-member with 403', async () => {
  mockedGroup.findById = jest.fn().mockResolvedValue({ members: [MEMBER_A] }) as any;
  const { req, res, next } = buildCtx(OUTSIDER.toString());

  await requireGroupMembership(req, res, next);

  const err = next.mock.calls[0][0] as AppError;
  expect(err).toBeInstanceOf(AppError);
  expect(err.statusCode).toBe(403);
  expect(res.locals.group).toBeUndefined();
});

it('rejects an unknown group with 404', async () => {
  mockedGroup.findById = jest.fn().mockResolvedValue(null) as any;
  const { req, res, next } = buildCtx(MEMBER_A.toString());

  await requireGroupMembership(req, res, next);

  const err = next.mock.calls[0][0] as AppError;
  expect(err.statusCode).toBe(404);
});
