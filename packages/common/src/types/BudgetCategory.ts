export type BudgetCategoryKind = 'fixed' | 'flexible' | 'ignored';

export interface BudgetCategory {
  id: string;
  name: string;
  kind: BudgetCategoryKind;
  /** Always 0 for `ignored` categories. */
  plannedAmount: number;
  color?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

export interface BudgetCategoryOverride {
  id: string;
  categoryId: string;
  month: number; // 1–12
  year: number;
  plannedAmount: number;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
}

/** One category's planned-vs-actual position for a single month. */
export interface BudgetCategorySummary {
  categoryId: string;
  name: string;
  kind: BudgetCategoryKind;
  color?: string;
  /** The month override's amount when one exists, else the category's base amount. */
  planned: number;
  isOverridden: boolean;
  /** Sum of debits tagged to this category in the month. */
  actual: number;
  /** fixed: max(planned, actual) · flexible: actual · ignored: 0 */
  cost: number;
  transactionCount: number;
}

export interface BudgetSummary {
  month: number;
  year: number;
  /** Salary override for the month when set, else the base salary. */
  income: number;
  usingActualIncome: boolean;
  categories: BudgetCategorySummary[];
  untagged: { amount: number; transactionCount: number };
  /** Sum of `planned` over fixed + flexible categories. */
  totalPlanned: number;
  /** Sum of `cost` over fixed + flexible categories, plus `untagged.amount`. */
  totalCost: number;
  /** income - totalCost */
  moneyLeft: number;
}

export namespace BudgetCategoryPayloads {
  export interface Create {
    name: string;
    kind: BudgetCategoryKind;
    /** Required and > 0 for fixed/flexible. Forced to 0 for `ignored`. */
    plannedAmount?: number;
    color?: string;
  }

  export interface Update {
    name?: string;
    kind?: BudgetCategoryKind;
    plannedAmount?: number;
    color?: string;
  }

  export interface SetOverride {
    month: number;
    year: number;
    plannedAmount: number;
  }

  export interface GetSummary {
    month: number;
    year: number;
  }
}
