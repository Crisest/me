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
  deletedAt?: number; // Unix timestamp in milliseconds
  cardId?: string;
}

export namespace TransactionPayloads {
  export interface Create {
    amount: number;
    description: string;
    category?: string;
    date: string;
    groupId: string;
    bankId?: string;
    cardId?: string;
  }

  export interface CreateMany {
    transactions: Transaction[];
    cardId: string;
    bankId: string;
  }

  export interface Update {
    amount?: number;
    description?: string;
    category?: string;
    date?: string;
  }

  export interface GetMany {
    month?: number;
    year?: number;
  }
}

export interface CreateTransactionPayload {
  amount: number;
  description: string;
  category?: string;
  date: string;
  groupId: string;
  bankId?: string;
  cardId?: string;
}

export interface CreateTransactionsPayload {
  transactions: Transaction[];
  cardId: string;
  bankId: string;
}

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
