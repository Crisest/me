import express, { Application } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import authRoutes from './auth.routes';
import { register } from './auth.service';
import * as userService from '../users/user.service';
import { truncateAll, closeTestDb } from '../../../test/setup';
import { signTestJwt } from '../../../test/helpers/auth';

const buildApp = (): Application => {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRoutes);
  app.use(errorHandler);
  return app;
};

const app = buildApp();

afterEach(truncateAll);
afterAll(closeTestDb);

// The limiter's in-memory store outlives each test and is keyed by IP + email.
let counter = 0;
const uniqueEmail = () => `t${Date.now()}-${counter++}@example.com`;

const jwtCookie = (res: request.Response) =>
  (res.headers['set-cookie'] as unknown as string[] | undefined)?.find(c =>
    c.startsWith('jwt=')
  );

const PASSWORD = 'password123';

describe('auth routes', () => {
  it('login sets a hardened cookie', async () => {
    const email = uniqueEmail();
    await register(email, PASSWORD);

    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    const cookie = jwtCookie(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=604800');
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('login with a wrong password returns 401 and sets no cookie', async () => {
    const email = uniqueEmail();
    await register(email, PASSWORD);

    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
    expect(jwtCookie(res)).toBeUndefined();
  });

  it('login rejects invalid bodies with 400', async () => {
    const bad = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' });
    const empty = await request(app).post('/auth/login').send({});

    expect(bad.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  it('login is case-insensitive on email', async () => {
    const email = `case${uniqueEmail()}`;
    await register(email, PASSWORD);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(200);
  });

  it('register auto-logs-in', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: uniqueEmail(), password: PASSWORD });

    expect(res.status).toBe(201);
    const cookie = jwtCookie(res);
    expect(cookie).toBeDefined();

    const me = await request(app).get('/auth/me').set('Cookie', cookie!);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(res.body.user.id);
  });

  it('register rejects a 7-character password with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: uniqueEmail(), password: '1234567' });

    expect(res.status).toBe(400);
  });

  it('register rejects a duplicate email in a different case with 409', async () => {
    const email = `dup${uniqueEmail()}`;
    await request(app).post('/auth/register').send({ email, password: PASSWORD });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(409);
  });

  it('limiter returns 429 on the 11th failed login without affecting other emails', async () => {
    const email = uniqueEmail();
    const attempt = (e: string) =>
      request(app).post('/auth/login').send({ email: e, password: 'wrong-password' });

    for (let i = 0; i < 10; i++) {
      expect((await attempt(email)).status).toBe(401);
    }
    expect((await attempt(email)).status).toBe(429);
    expect((await attempt(uniqueEmail())).status).toBe(401);
  });

  it('logout clears the cookie', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(200);
    const cookie = jwtCookie(res);
    expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('/me without a cookie returns 401', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
  });

  it('/me with a garbage token returns 401 and clears the cookie', async () => {
    const res = await request(app).get('/auth/me').set('Cookie', 'jwt=garbage');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid authentication token');
    expect(jwtCookie(res)).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('/me for a deleted user returns 401 and clears the cookie', async () => {
    const token = signTestJwt('00000000-0000-7000-8000-000000000000');

    const res = await request(app).get('/auth/me').set('Cookie', `jwt=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('User not found');
    expect(jwtCookie(res)).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('/me returns 500 and keeps the cookie when the DB fails', async () => {
    const user = await register(uniqueEmail(), PASSWORD);
    const spy = jest
      .spyOn(userService, 'findUserById')
      .mockRejectedValueOnce(new Error('db down'));

    try {
      const res = await request(app)
        .get('/auth/me')
        .set('Cookie', `jwt=${signTestJwt(user.id)}`);

      expect(res.status).toBe(500);
      expect(jwtCookie(res)).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});
