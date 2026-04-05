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
  // Populated enrichment fields (optional — present when backend populates them)
  cardName?: string;
  bankName?: string;
  ownerEmail?: string;
  ownerName?: string;
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
}
