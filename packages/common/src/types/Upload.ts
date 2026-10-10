export interface Upload {
  id: string;
  fileName: string;
  fileHash: string;
  accountId: string;
  transactionCount: number;
  createdBy: string;
  createdAt: number;
}

export namespace UploadPayloads {
  export interface CheckDuplicate {
    fileName: string;
    fileHash: string;
    accountId: string;
  }

  export interface CheckDuplicateResponse {
    isDuplicate: boolean;
    existingUpload?: Upload;
  }
}
