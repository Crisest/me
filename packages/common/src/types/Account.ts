export type AccountType =
  | 'depository'
  | 'credit'
  | 'loan'
  | 'investment'
  | 'other';

export interface Account {
  id: string;
  bankId: string;
  plaidAccountId: string;
  name: string;          // e.g. "Plaid Checking"
  officialName?: string; // e.g. "Plaid Gold Standard 0% Interest Checking"
  mask?: string;         // last 4 digits, e.g. "0000"
  type: AccountType;
  subtype?: string;      // e.g. "checking", "savings", "credit card"
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}
