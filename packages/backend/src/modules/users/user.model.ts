import mongoose, { Document, Schema } from 'mongoose';
import { User as CommonUser } from '@portfolio/common/src/types/User';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
  groups: mongoose.Types.ObjectId[];
  toUser(): CommonUser;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: String,
  createdAt: { type: Date, default: Date.now },
  groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
});

userSchema.methods.toUser = function (): CommonUser {
  return {
    id: this._id.toString(),
    email: this.email,
    passwordHash: this.passwordHash,
    name: this.name,
    createdAt: this.createdAt.toISOString(),
    groups: this.groups.map((id: mongoose.Types.ObjectId) => id.toString()),
  };
};

export const User = mongoose.model<IUser>('User', userSchema);
