import { Request, Response } from 'express';
import * as groupService from './group.service';

export const createGroup = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.user!.id;
    const group = await groupService.createGroup(name, userId);
    res.status(201).json(group);
  } catch (err) {
    req.log.error({ err }, 'Failed to create group');
    res.status(500).json({ error: 'Failed to create group' });
  }
};

export const joinGroup = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const userId = req.user!.id;
    const group = await groupService.joinGroupByCode(code, userId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (err) {
    req.log.error({ err }, 'Failed to join group');
    res.status(500).json({ error: 'Failed to join group' });
  }
};

export const getGroups = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const groups = await groupService.getUserGroups(userId);
    res.json(groups);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch groups');
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
};

export const addMember = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const updatedGroup = await groupService.addUserToGroup(groupId, userId);
    res.json(updatedGroup);
  } catch (err) {
    req.log.error({ err }, 'Failed to add member');
    res.status(500).json({ error: 'Failed to add member' });
  }
};

export const removeMember = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const updatedGroup = await groupService.removeUserFromGroup(
      groupId,
      userId
    );
    res.json(updatedGroup);
  } catch (err) {
    req.log.error({ err }, 'Failed to remove member');
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = req.user!.id;
    const deleted = await groupService.deleteGroup(groupId, userId);
    if (!deleted) {
      return res
        .status(404)
        .json({ error: 'Group not found or not authorized' });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, 'Failed to delete group');
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

export const getGroupTransactions = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    const options = {
      month: isNaN(month) ? undefined : month,
      year: isNaN(year) ? undefined : year,
    };

    const transactions = await groupService.getGroupTransactions(
      groupId,
      options
    );
    res.json(transactions);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch group transactions');
    res.status(500).json({ error: 'Failed to fetch group transactions' });
  }
};

export const getGroupInsights = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const month = parseInt(req.params.month);
    const year = req.query.year
      ? parseInt(req.query.year as string)
      : undefined;

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid month parameter' });
    }

    const insights = await groupService.getGroupInsights(groupId, month, year);
    res.json(insights);
  } catch (err) {
    req.log.error({ err }, 'Failed to fetch group insights');
    res.status(500).json({ error: 'Failed to fetch group insights' });
  }
};
