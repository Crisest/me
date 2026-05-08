import type { PlaidStatus } from './Plaid';

export interface Bank {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  isPlaidLinked: boolean;
  plaidStatus?: PlaidStatus;
  plaidInstitutionId?: string;
}

export interface CreateBankPayload {
  name: string;
}
