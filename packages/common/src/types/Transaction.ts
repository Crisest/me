export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category?: string;
  date: string; // ISO string
  groupId: string;
  createdBy: string; // user ID
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
}

export interface CreateTransactionPayload {
  amount: number;
  description: string;
  category?: string;
  date: string;
  groupId: string;
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
