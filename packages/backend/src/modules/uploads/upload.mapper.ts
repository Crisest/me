import type { Upload } from '@portfolio/common';
import type { UploadRow } from '../../db/schema';

export const toUpload = (row: UploadRow): Upload => ({
  id: row.id,
  fileName: row.fileName,
  fileHash: row.fileHash,
  accountId: row.accountId ?? '',
  transactionCount: row.transactionCount,
  createdBy: row.createdBy,
  createdAt: row.createdAt.getTime(),
});
