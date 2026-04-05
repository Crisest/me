import { Request, Response } from 'express';
import { UploadPayloads } from '@portfolio/common';
import * as uploadService from './upload.service';

export const checkDuplicateHandler = async (req: Request, res: Response) => {
  try {
    const params = req.body as UploadPayloads.CheckDuplicate;
    const result = await uploadService.checkDuplicate(params, req.user!.id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, 'Failed to check duplicate upload');
    res.status(500).json({ error: 'Failed to check duplicate upload' });
  }
};
