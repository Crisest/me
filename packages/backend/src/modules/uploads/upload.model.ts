import mongoose, { Document, Model } from 'mongoose';
import { Upload } from '@portfolio/common';

export interface IUpload extends Document {
  fileName: string;
  fileHash: string;
  cardId: mongoose.Types.ObjectId;
  transactionCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  toUpload(): Upload;
}

const UploadSchema = new mongoose.Schema<IUpload>(
  {
    fileName: { type: String, required: true },
    fileHash: { type: String, required: true },
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Card',
      required: true,
    },
    transactionCount: { type: Number, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

UploadSchema.index({ fileHash: 1, cardId: 1 });
UploadSchema.index({ fileName: 1, cardId: 1 });

UploadSchema.methods.toUpload = function (): Upload {
  return {
    id: this._id.toString(),
    fileName: this.fileName,
    fileHash: this.fileHash,
    cardId: this.cardId.toString(),
    transactionCount: this.transactionCount,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.getTime(),
  };
};

export const UploadModel = mongoose.model<IUpload>('Upload', UploadSchema);
