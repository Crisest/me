export interface Group {
  id: string;
  name: string;
  members: string[]; // user IDs
  createdBy: string; // user ID
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  inviteCode: string;
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

export interface GroupSummary {
  month: number; // 1-12, the month these numbers cover
  year: number;
  budget: number; // combined member budget (overrides applied)
  totalSpent: number; // combined non-fixed spend for the month
  moneyLeft: number; // budget - fixed - spent
}

export interface GroupWithMembers {
  id: string;
  name: string;
  members: GroupMember[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  inviteCode: string;
  summary?: GroupSummary; // present on the group-list response
}
