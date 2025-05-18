export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface AuthError {
  message: string;
  code:
    | 'INVALID_CREDENTIALS'
    | 'USER_NOT_FOUND'
    | 'EMAIL_EXISTS'
    | 'VALIDATION_ERROR';
}
