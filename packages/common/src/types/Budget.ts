export interface FixedExpense {
  name: string;
  amount: number;
}

export interface Budget {
  id: string;
  salary: number;
  fixedExpenses: FixedExpense[];
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export namespace BudgetPayloads {
  export interface Upsert {
    salary: number;
    fixedExpenses: { name: string; amount: number }[];
  }
}
