import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/env';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { register, login } from './auth.service';
import { findUserById } from '../users/user.service';

afterEach(truncateAll);
afterAll(closeTestDb);

describe('auth.service', () => {
  it('registers a user with a hashed password', async () => {
    const user = await register('new@example.com', 'password123', 'New');
    expect(user.email).toBe('new@example.com');
    expect(user.passwordHash).not.toBe('password123');
    expect(user.id).toMatch(/-7[0-9a-f]{3}-/);
  });

  it('rejects a duplicate email', async () => {
    await register('dupe@example.com', 'password123');
    await expect(register('dupe@example.com', 'password123')).rejects.toThrow(
      'User already exists'
    );
  });

  it('logs in with correct credentials and signs a usable token', async () => {
    const created = await register('login@example.com', 'password123');
    const { user, token } = await login('login@example.com', 'password123');

    expect(user.id).toBe(created.id);
    const decoded = jwt.verify(token, getConfig().jwtSecret) as {
      userId: string;
      email: string;
    };
    expect(decoded.userId).toBe(created.id);
    expect(decoded.email).toBe('login@example.com');
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    await register('who@example.com', 'password123');
    await expect(login('who@example.com', 'wrong')).rejects.toThrow(
      'Invalid credentials'
    );
    await expect(login('nobody@example.com', 'password123')).rejects.toThrow(
      'Invalid credentials'
    );
  });

  it('findUserById returns undefined for an unknown id', async () => {
    expect(
      await findUserById('00000000-0000-7000-8000-000000000000')
    ).toBeUndefined();
  });

});

describe('register', () => {
  it('gives the new user a solo household and an active membership', async () => {
    const { register } = await import('./auth.service');
    const { getActiveMembership, getHouseholdForUser } = await import(
      '../households/household.service'
    );

    const user = await register('ada@example.com', 'password123', 'Ada');

    const membership = await getActiveMembership(user.id);
    expect(membership).toBeDefined();

    const household = await getHouseholdForUser(user.id);
    expect(household?.name).toBe("Ada's Household");
    expect(household?.members.map(m => m.id)).toEqual([user.id]);
  });

  it('names the household from the email when no name is given', async () => {
    const { register } = await import('./auth.service');
    const { getHouseholdForUser } = await import(
      '../households/household.service'
    );

    const user = await register('solo@example.com', 'password123');
    const household = await getHouseholdForUser(user.id);

    expect(household?.name).toBe("solo@example.com's Household");
  });

  it('creates no user when household creation fails', async () => {
    const { register } = await import('./auth.service');
    const householdService = await import('../households/household.service');
    const { db } = await import('../../db/client');
    const { users } = await import('../../db/schema');

    const spy = jest
      .spyOn(householdService, 'createHousehold')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(
      register('rollback@example.com', 'password123')
    ).rejects.toThrow('boom');

    const rows = await db.select().from(users);
    expect(rows.find(u => u.email === 'rollback@example.com')).toBeUndefined();

    spy.mockRestore();
  });
});
