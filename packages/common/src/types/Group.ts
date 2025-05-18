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
