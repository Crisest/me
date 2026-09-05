export interface TransactionInsights {
  totalSpent: number; // Sum of all debits (negative)
  totalIncome: number; // Sum of all credits (positive)
  netAmount: number; // Income - Spent
  debitCount: number; // Number of debit transactions
  creditCount: number; // Number of credit transactions
  averageDebit: number; // Average debit transaction
  averageCredit: number; // Average credit transaction
  /** Of `totalSpent`, the part tagged to a `fixed` category. Lets a caller
   * that already subtracts the fixed *plan* take the fixed *charges* back
   * out, instead of paying for them twice. */
  fixedSpent: number;
  matchedFixedCount: number;
}

export interface GetMonthlyInsightsParams {
  month: number;
  year?: number;
}
