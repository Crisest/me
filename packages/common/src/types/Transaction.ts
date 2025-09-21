export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category?: string;
  date: string; // ISO string for transaction date
  groupId: string;
  bankId?: string;
  createdBy: string; // user ID
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt?: number; // Unix timestamp in milliseconds
}

export interface CreateTransactionPayload {
  amount: number;
  description: string;
  category?: string;
  date: string;
  groupId: string;
  bankId?: string;
}

export interface CreateTransactionsPayload
  extends Array<CreateTransactionPayload> {}

export interface UpdateTransactionPayload {
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
}

export interface GetTransactionsQuery {
  month?: number;
}

export interface GetTransactionsResponse {
  transactions: Transaction[];
}
