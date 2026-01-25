export interface TransactionInsights {
  totalSpent: number; // Sum of all debits (negative)
  totalIncome: number; // Sum of all credits (positive)
  netAmount: number; // Income - Spent
  debitCount: number; // Number of debit transactions
  creditCount: number; // Number of credit transactions
  averageDebit: number; // Average debit transaction
  averageCredit: number; // Average credit transaction
}

export interface GetMonthlyInsightsParams {
  month: number;
  year?: number;
}
