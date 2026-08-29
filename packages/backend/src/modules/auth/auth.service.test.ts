import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/env';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { makeUser } from '../../../test/helpers/factories';
import { register, login } from './auth.service';
import { findUserById, getGroupIdsForUser } from '../users/user.service';
import { db } from '../../db/client';
import { groupMembers, groups } from '../../db/schema';

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

  it('getGroupIdsForUser reads through the join table', async () => {
    const user = await makeUser();
    expect(await getGroupIdsForUser(user.id)).toEqual([]);

    const [group] = await db
      .insert(groups)
      .values({ name: 'G', inviteCode: 'CODE1', createdBy: user.id })
      .returning();
    await db.insert(groupMembers).values({ groupId: group.id, userId: user.id });

    expect(await getGroupIdsForUser(user.id)).toEqual([group.id]);
  });
});
