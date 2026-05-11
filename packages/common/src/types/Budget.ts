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

export interface BudgetOverride {
  id: string;
  month: number;        // 1–12
  year: number;
  salary: number;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export namespace BudgetOverridePayloads {
  export interface Upsert {
    month: number;
    year: number;
    salary: number;
  }
  export interface GetOne {
    month: number;
    year: number;
  }
}
