import { Group } from '@customTypes/Group.ts';

export interface User {
  username: string;
  email: string;
  password: string;
  isConfirmed: boolean;
  tokens: string[]; // assuming tokens are strings
  groups: Group[]; // assuming groups are objects of Group interface
}
