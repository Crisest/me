export interface Bank {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateBankPayload {
  name: string;
}
