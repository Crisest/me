export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category?: string;
  createdBy: string; // user ID
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt?: number; // Unix timestamp in milliseconds
  deletedAt?: number; // Unix timestamp in milliseconds
}

export namespace FixedExpensePayloads {
  export interface Create {
    name: string;
    amount: number;
    category?: string;
  }

  export interface Update {
    name?: string;
    amount?: number;
    category?: string;
  }
}

export interface CreateFixedExpensePayload {
  name: string;
  amount: number;
  category?: string;
}

export interface UpdateFixedExpensePayload {
  name?: string;
  amount?: number;
  category?: string;
}
