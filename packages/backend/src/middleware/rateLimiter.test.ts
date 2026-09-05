import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { apiKeyGenerator, callerUserId } from './rateLimiter';
import { getConfig } from '@/config/env';

const asRequest = (cookies: Record<string, string>, ip?: string): Request =>
  ({ cookies, ip }) as unknown as Request;

const signFor = (userId: string): string =>
  jwt.sign({ userId }, getConfig().jwtSecret, { expiresIn: '1h' });

describe('rate limiter key generation', () => {
  describe('callerUserId', () => {
    it('reads the user id out of a valid jwt cookie', () => {
      const req = asRequest({ jwt: signFor('user-a') });
      expect(callerUserId(req)).toBe('user-a');
    });

    it('returns undefined when there is no cookie', () => {
      expect(callerUserId(asRequest({}))).toBeUndefined();
    });

    it('returns undefined for a token signed with the wrong secret', () => {
      const forged = jwt.sign({ userId: 'user-a' }, 'not-the-secret');
      expect(callerUserId(asRequest({ jwt: forged }))).toBeUndefined();
    });

    it('returns undefined for an expired token', () => {
      const expired = jwt.sign({ userId: 'user-a' }, getConfig().jwtSecret, {
        expiresIn: '-1s',
      });
      expect(callerUserId(asRequest({ jwt: expired }))).toBeUndefined();
    });
  });

  describe('apiKeyGenerator', () => {
    // The whole point of the change: two devices on one home network share a
    // public IP, so an IP-keyed limiter would put both users in one bucket.
    it('gives two signed-in users separate buckets from the same ip', () => {
      const ip = '::ffff:192.168.1.55';
      const a = apiKeyGenerator(asRequest({ jwt: signFor('user-a') }, ip));
      const b = apiKeyGenerator(asRequest({ jwt: signFor('user-b') }, ip));
      expect(a).not.toBe(b);
    });

    it('gives one user the same bucket across two devices', () => {
      const token = signFor('user-a');
      const phone = apiKeyGenerator(asRequest({ jwt: token }, '192.168.1.142'));
      const laptop = apiKeyGenerator(asRequest({ jwt: token }, '192.168.1.55'));
      expect(phone).toBe(laptop);
    });

    it('falls back to the ip when unauthenticated', () => {
      expect(apiKeyGenerator(asRequest({}, '192.168.1.55'))).toBe(
        'ip:192.168.1.55'
      );
    });

    it('treats an ipv4-mapped address as the same bucket as its plain form', () => {
      expect(apiKeyGenerator(asRequest({}, '::ffff:192.168.1.55'))).toBe(
        apiKeyGenerator(asRequest({}, '192.168.1.55'))
      );
    });

    // An invalid token must not collapse every anonymous caller into one
    // bucket keyed on `undefined`.
    it('keys a rejected token by ip rather than sharing one bucket', () => {
      const forged = jwt.sign({ userId: 'user-a' }, 'not-the-secret');
      expect(apiKeyGenerator(asRequest({ jwt: forged }, '192.168.1.55'))).toBe(
        'ip:192.168.1.55'
      );
    });
  });
});
