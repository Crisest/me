import mongoose, { Document } from 'mongoose';
import { Group as CommonGroup, GroupWithMembers, GroupMember } from '@portfolio/common';

export interface IGroup extends Document {
  name: string;
  members: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  inviteCode: string;
  toGroup(): CommonGroup;
  toGroupWithMembers(): GroupWithMembers;
}

const GroupSchema = new mongoose.Schema<IGroup>(
  {
    name: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inviteCode: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

GroupSchema.methods.toGroup = function (): CommonGroup {
  return {
    id: this._id.toString(),
    name: this.name,
    members: this.members.map((id: mongoose.Types.ObjectId) => id.toString()),
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
    inviteCode: this.inviteCode,
  };
};

GroupSchema.methods.toGroupWithMembers = function (): GroupWithMembers {
  return {
    id: this._id.toString(),
    name: this.name,
    members: this.members.map((member: any): GroupMember => ({
      id: member._id.toString(),
      email: member.email,
    })),
    createdBy: this.createdBy.toString(),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
    inviteCode: this.inviteCode,
  };
};

export const Group = mongoose.model<IGroup>('Group', GroupSchema);
