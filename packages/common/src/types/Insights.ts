export interface TransactionInsights {
  totalSpent: number; // Sum of all debits (negative)
  totalIncome: number; // Sum of all credits (positive)
  netAmount: number; // Income - Spent
  debitCount: number; // Number of debit transactions
  creditCount: number; // Number of credit transactions
  averageDebit: number; // Average debit transaction
  averageCredit: number; // Average credit transaction
  matchedFixedCount: number;
}

export interface GetMonthlyInsightsParams {
  month: number;
  year?: number;
}

export interface GroupBudgetInsights {
  totalSpent: number;
  debitCount: number;
  budget: number; // sum of all members' salaries
  totalFixed: number; // sum of all members' fixed expense amounts
  fixedCount: number; // total number of fixed expense entries across all members
  moneyLeft: number; // budget - totalFixed - totalSpent
}
