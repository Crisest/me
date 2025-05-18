import { User as CommonUser } from '@portfolio/common';

export interface UserWithUIState extends CommonUser {
  isOnline?: boolean;
  avatar?: string;
}
