import Group from './group.model';
import { IGroup } from './group.model';

export const createGroup = async (
  name: string,
  userId: string
): Promise<IGroup> => {
  const group = new Group({
    name,
    members: [userId],
    createdBy: userId,
  });
  return await group.save();
};

export const getUserGroups = async (userId: string): Promise<IGroup[]> => {
  return await Group.find({ members: userId }).populate('members', 'email');
};

export const addUserToGroup = async (
  groupId: string,
  userId: string
): Promise<IGroup | null> => {
  return await Group.findByIdAndUpdate(
    groupId,
    { $addToSet: { members: userId } },
    { new: true }
  );
};

export const removeUserFromGroup = async (
  groupId: string,
  userId: string
): Promise<IGroup | null> => {
  return await Group.findByIdAndUpdate(
    groupId,
    { $pull: { members: userId } },
    { new: true }
  );
};
