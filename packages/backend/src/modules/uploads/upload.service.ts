import { UploadPayloads } from '@portfolio/common';
import { UploadModel } from './upload.model';

export const checkDuplicate = async (
  params: UploadPayloads.CheckDuplicate,
  userId: string
): Promise<UploadPayloads.CheckDuplicateResponse> => {
  const existing = await UploadModel.findOne({
    createdBy: userId,
    cardId: params.cardId,
    $or: [{ fileHash: params.fileHash }, { fileName: params.fileName }],
  });

  if (existing) {
    return { isDuplicate: true, existingUpload: existing.toUpload() };
  }

  return { isDuplicate: false };
};

export const createUploadRecord = async (
  fileName: string,
  fileHash: string,
  cardId: string,
  transactionCount: number,
  userId: string
) => {
  const upload = await UploadModel.create({
    fileName,
    fileHash,
    cardId,
    transactionCount,
    createdBy: userId,
  });
  return upload.toUpload();
};
