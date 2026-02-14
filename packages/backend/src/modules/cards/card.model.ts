import mongoose, { Document, Model } from 'mongoose';
import { Card, CreateCardPayload } from '@portfolio/common';

export interface ICard extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toCard(): Card;
}

interface CardModelStatics extends Model<ICard> {
  fromCreatePayload(data: CreateCardPayload, userId: string): Partial<ICard>;
}

const CardSchema = new mongoose.Schema<ICard>(
  {
    name: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

CardSchema.methods.toCard = function (): Card {
  return {
    id: this._id.toString(),
    name: this.name,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

CardSchema.statics.fromCreatePayload = function (
  data: CreateCardPayload,
  userId: string
): Partial<ICard> {
  return {
    name: data.name,
    createdBy: new mongoose.Types.ObjectId(userId),
  };
};

export const CardModel = mongoose.model<ICard, CardModelStatics>(
  'Card',
  CardSchema
);
