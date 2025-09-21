import mongoose, { Document, Model } from 'mongoose';
import { Card as CommonCard, CreateCardPayload } from '@portfolio/common';

export interface ICard extends Document {
  name: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt?: Date;
  toCard(): CommonCard;
}

// Add interface for model statics
interface CardModel extends Model<ICard> {
  fromCommonCard(
    data: CreateCardPayload,
    userId: mongoose.Types.ObjectId
  ): Partial<ICard>;
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

CardSchema.methods.toCard = function (): CommonCard {
  return {
    id: this._id.toString(),
    name: this.name,
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

CardSchema.statics.fromCommonCard = function (
  data: CreateCardPayload,
  userId: mongoose.Types.ObjectId
): Partial<ICard> {
  return {
    name: data.name,
    createdBy: userId,
  };
};

export const Card = mongoose.model<ICard, CardModel>('Card', CardSchema);
