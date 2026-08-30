export interface HouseholdMember {
  id: string;
  email: string;
  name?: string;
  /** ISO — when this member joined. */
  joinedAt: string;
  /** ISO — when they left, absent while active. */
  leftAt?: string;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  archived: boolean;
  /** Absent when the creating user has been deleted. */
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  /** Active members only. */
  members: HouseholdMember[];
}

export namespace HouseholdPayloads {
  export interface Create {
    name: string;
  }

  export interface Join {
    code: string;
  }

  export interface RemoveMember {
    userId: string;
  }

  export interface Rename {
    name: string;
  }
}
