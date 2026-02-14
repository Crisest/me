import { FixedExpense } from './FixedExpense';

export interface Budget {
  id: string;
  salary: number;
  fixedExpenses: string[]; // array of FixedExpense IDs
  createdBy: string; // user ID
  createdAt: number; // Unix timestamp in milliseconds
  updatedAt?: number; // Unix timestamp in milliseconds
  deletedAt?: number; // Unix timestamp in milliseconds
}

export namespace BudgetPayloads {
  export interface Create {
    salary: number;
    fixedExpenseIds?: string[];
  }

  export interface Update {
    salary?: number;
    fixedExpenseIds?: string[];
  }
}

export interface CreateBudgetPayload {
  salary: number;
  fixedExpenseIds?: string[];
}

export interface UpdateBudgetPayload {
  salary?: number;
  fixedExpenseIds?: string[];
}

export interface BudgetSummary {
  salary: number;
  fixedExpensesTotal: number;
  variableExpensesTotal: number;
  remaining: number;
  month: number;
  year: number;
}
