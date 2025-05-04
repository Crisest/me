// shared/types/User.ts
export interface User {
  id: string; // important! "id" as a string, not "_id"
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: string; // ISO string (good for frontend)
  groups: string[];  // Array of group ids (as strings)
}