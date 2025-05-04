export interface Expense {
  date: Date;
  amount: number;
  userId: string; // assuming userId is a string, reference to User ID
  groupId: string; // assuming groupId is a string, reference to Group ID
  isForgiven?: boolean; // optional property
}
