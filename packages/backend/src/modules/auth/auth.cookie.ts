import { Response, CookieOptions } from 'express';
import { getConfig } from '@/config/env';

const AUTH_COOKIE = 'jwt';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: getConfig().cookieSecure,
  sameSite: 'strict',
  path: '/',
});

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(AUTH_COOKIE, token, { ...baseOptions(), maxAge: SEVEN_DAYS_MS });
};

export const clearAuthCookie = (res: Response): void => {
  res.cookie(AUTH_COOKIE, '', { ...baseOptions(), expires: new Date(0) });
};
