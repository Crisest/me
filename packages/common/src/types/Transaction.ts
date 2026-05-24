export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category?: string;
  subDescription?: string;
  date: string;
  groupId: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
  cardId?: string;
  accountId?: string; // NEW — Mongo id of the linked Account (Plaid txs)
  plaidTransactionId?: string;
  logoUrl?: string; // NEW — merchant logo from Plaid
  categoryIconUrl?: string; // NEW — Plaid PFC category icon (fallback)
  // Populated enrichment fields (optional — present when backend populates them)
  cardName?: string;
  bankName?: string;
  accountName?: string; // NEW — e.g. "Plaid Checking"
  accountMask?: string; // NEW — e.g. "0000"
  ownerEmail?: string;
  ownerName?: string;
  fixedExpenseId?: string;
}

export namespace TransactionPayloads {
  export interface Create {
    amount: number;
    description: string;
    category?: string;
    subDescription?: string;
    date: string;
    groupId: string;
    cardId?: string;
  }

  export interface CreateMany {
    transactions: Transaction[];
    cardId: string;
    fileName: string;
    fileHash: string;
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

  export interface MatchFixedExpense {
    fixedExpenseId: string | null; // null = unmatch
  }
}
