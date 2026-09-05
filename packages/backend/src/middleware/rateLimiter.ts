import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { getConfig } from '@/config/env';

/**
 * Strips the IPv4-mapped IPv6 prefix so `::ffff:192.168.1.55` and
 * `192.168.1.55` are one bucket rather than two.
 */
const normalizeIp = (ip: string): string =>
  ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;

/**
 * The caller's user id, read straight from the JWT cookie.
 *
 * The limiter runs before `authMiddleware`, so `req.user` is not populated yet
 * and the token has to be verified here. Verification is an HMAC check, not a
 * database read — `authMiddleware` still does the user lookup afterwards.
 *
 * Returns undefined for anything unauthenticated or invalid; those fall back
 * to the IP bucket rather than sharing one bucket keyed on `undefined`.
 */
export const callerUserId = (req: Request): string | undefined => {
  const token = req.cookies?.jwt;
  if (!token) return undefined;
  try {
    const decoded = jwt.verify(token, getConfig().jwtSecret) as {
      userId?: string;
    };
    return decoded.userId;
  } catch {
    return undefined;
  }
};

/**
 * One bucket per signed-in user, falling back to one per IP.
 *
 * Keying on the user rather than the address is what stops a household from
 * sharing a single budget: every device behind a home router presents the same
 * public IP, so an IP-keyed limiter counts a family as one client. It also
 * means a single person opening the app on their phone and laptop at once is
 * still one bucket, which is the intent — the limit is there to catch runaway
 * clients, not to ration devices.
 */
export const apiKeyGenerator = (req: Request): string => {
  const userId = callerUserId(req);
  return userId ? `user:${userId}` : `ip:${normalizeIp(req.ip ?? 'unknown')}`;
};

const { windowMs, max } = getConfig().rateLimit;

export const apiLimiter = rateLimit({
  windowMs,
  max,
  keyGenerator: apiKeyGenerator,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.',
  },
});
