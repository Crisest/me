// modules/groups/group.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  members: mongoose.Types.ObjectId[]; // user IDs
  createdBy: mongoose.Types.ObjectId;
}

const GroupSchema = new Schema(
  {
    name: { type: String, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IGroup>('Group', GroupSchema);
