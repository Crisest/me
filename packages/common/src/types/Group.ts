export interface Group {
  id: string;
  name: string;
  members: string[]; // user IDs
  createdBy: string; // user ID
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface CreateGroupPayload {
  name: string;
  members?: string[];
}

export interface UpdateGroupPayload {
  name?: string;
  members?: string[];
}

export interface GroupMember {
  id: string;
  email: string;
}

export interface GroupWithMembers {
  id: string;
  name: string;
  members: GroupMember[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
