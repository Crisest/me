// import { Response } from 'express';
// import * as groupService from './group.service';

// export const createGroup = async (req: Request, res: Response) => {
//   const { name } = req.body as any;
//   const userId = req.user!._id;

//   try {
//     const group = await groupService.createGroup(name, userId);
//     res.status(201).json(group);
//   } catch (err) {
//     res.status(500).json({ message: 'Error creating group', error: err });
//   }
// };

// export const getGroups = async (req: Request, res: Response) => {
//   const { id } = req.user as any;

//   try {
//     const groups = await groupService.getUserGroups(id);
//     res.status(200).json(groups);
//   } catch (err) {
//     res.status(500).json({ message: 'Error fetching groups', error: err });
//   }
// };

// export const addMember = async (req: Request, res: Response) => {
//   const { groupId, userId } = req.body;

//   try {
//     const updatedGroup = await groupService.addUserToGroup(groupId, userId);
//     res.status(200).json(updatedGroup);
//   } catch (err) {
//     res.status(500).json({ message: 'Error adding member', error: err });
//   }
// };

// export const removeMember = async (req: Request, res: Response) => {
//   const { groupId, userId } = req.body;

//   try {
//     const updatedGroup = await groupService.removeUserFromGroup(
//       groupId,
//       userId
//     );
//     res.status(200).json(updatedGroup);
//   } catch (err) {
//     res.status(500).json({ message: 'Error removing member', error: err });
//   }
// };
