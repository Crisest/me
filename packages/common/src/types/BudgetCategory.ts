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

/** One member's contribution to a category's actual spend in a month. */
export interface CategoryMemberActual {
  userId: string;
  name?: string;
  email: string;
  actual: number;
  transactionCount: number;
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
  /** Always populated. One entry in a solo household. API-only — no UI renders it. */
  byMember: CategoryMemberActual[];
}

/** One member's income contribution to a month. */
export interface MemberIncome {
  userId: string;
  name?: string;
  email: string;
  /** The month's override when filed, else the member's base salary. */
  amount: number;
  /** false = fell back to base salary; no actual income filed for this month. */
  isActual: boolean;
}

/**
 * FROZEN TYPE. Instances of this are stored verbatim as jsonb in
 * `budget_month_snapshots.summary`. A closed month is read back exactly as it
 * was written, so this type may only ever GAIN OPTIONAL FIELDS. Removing or
 * renaming one orphans every closed month and no migration can repair it —
 * the pre-change values are the record.
 */
export interface BudgetSummary {
  month: number;
  year: number;
  /** Salary override for the month when set, else the base salary. */
  income: number;
  /**
   * True when ANY member filed actual income. Kept for compatibility — it
   * cannot answer "did everyone file", so read `byMember` for that.
   */
  usingActualIncome: boolean;
  /**
   * One entry per member whose tenure covers the month, sorted by userId.
   * Optional per this type's frozen-field rule — always present on a summary
   * this codebase computes, absent only on one frozen before the field
   * existed. Read it as `byMember ?? []`.
   */
  byMember?: MemberIncome[];
  categories: BudgetCategorySummary[];
  untagged: {
    amount: number;
    transactionCount: number;
    byMember: CategoryMemberActual[];
  };
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
    /** Whose money the figures cover. Defaults to the whole household. */
    scope?: 'mine' | 'household';
  }
}
