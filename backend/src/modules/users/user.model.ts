import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
  groups: mongoose.Types.ObjectId[];
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: String,
  createdAt: { type: Date, default: Date.now },
  groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
});

export const User = mongoose.model<IUser>('User', userSchema);
