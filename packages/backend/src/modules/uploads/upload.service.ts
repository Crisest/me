import { and, eq, or } from 'drizzle-orm';
import { Upload, UploadPayloads } from '@portfolio/common';
import { db, type Db, type Tx } from '../../db/client';
import { uploads } from '../../db/schema';
import { toUpload } from './upload.mapper';

export const checkDuplicate = async (
  params: UploadPayloads.CheckDuplicate,
  userId: string
): Promise<UploadPayloads.CheckDuplicateResponse> => {
  const existing = await db.query.uploads.findFirst({
    where: and(
      eq(uploads.createdBy, userId),
      eq(uploads.cardId, params.cardId),
      // Mongo's $or over the two lookup indexes.
      or(
        eq(uploads.fileHash, params.fileHash),
        eq(uploads.fileName, params.fileName)
      )
    ),
  });

  if (existing) {
    return { isDuplicate: true, existingUpload: toUpload(existing) };
  }
  return { isDuplicate: false };
};

/**
 * `executor` lets the caller pass an open transaction so the upload record
 * and its transactions commit together. Defaults to the pooled db.
 */
export const createUploadRecord = async (
  fileName: string,
  fileHash: string,
  cardId: string,
  transactionCount: number,
  userId: string,
  executor: Db | Tx = db
): Promise<Upload> => {
  const [row] = await executor
    .insert(uploads)
    .values({ fileName, fileHash, cardId, transactionCount, createdBy: userId })
    .returning();
  return toUpload(row);
};
