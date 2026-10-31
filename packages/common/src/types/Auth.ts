import type { User } from './User';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'passwordHash'>;
}

export interface RegisterResponse extends LoginResponse {
  message: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface AppConfig {
  appUrl: string;
}

export interface MeResponse {
  id: string;
  email: string;
  name?: string;
  config: AppConfig;
}
