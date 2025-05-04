import { User } from '@customTypes/User.ts';

export interface Group {
  name: string;
  settings: {
    isPrimary: boolean;
    jumpToExpense: boolean;
  };
  users: User[]; // assuming users are objects of User interface
}
