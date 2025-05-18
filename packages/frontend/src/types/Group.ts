import type { Group } from '@portfolio/common';

export interface GroupSettings {
  isPrimary: boolean;
  jumpToExpense: boolean;
}

export interface GroupWithSettings extends Group {
  settings: GroupSettings;
}
