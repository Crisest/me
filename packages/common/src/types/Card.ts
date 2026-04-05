export interface Card {
  id: string;
  name: string;
  bankId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateCardPayload {
  name: string;
  bankId: string;
}
