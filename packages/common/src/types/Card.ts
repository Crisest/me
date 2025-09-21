export interface Card {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateCardPayload {
  name: string;
}
