import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody, validateQuery } from './validateRequest';
import { AppError } from './errorHandler';

const buildApp = (handler: express.RequestHandler) => {
  const app = express();
  app.use(express.json());
  app.post('/body', validateBody(z.object({ name: z.string().min(1) })), handler);
  app.get(
    '/query',
    validateQuery(z.object({ month: z.coerce.number().int().min(1).max(12) })),
    handler
  );
  app.use(
    (
      err: AppError,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(err.statusCode || 500).json({ message: err.message });
    }
  );
  return app;
};

describe('validateBody / validateQuery', () => {
  it('passes a valid body through and exposes the parsed value', async () => {
    const app = buildApp((req, res) => {
      res.json({ received: req.body });
    });
    const res = await request(app).post('/body').send({ name: 'Chase' });
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ name: 'Chase' });
  });

  it('rejects an invalid body with 400 and names the field', async () => {
    const app = buildApp((_req, res) => res.json({}));
    const res = await request(app).post('/body').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('name');
  });

  it('coerces query strings to numbers', async () => {
    const app = buildApp((req, res) => {
      res.json({ month: req.query.month, type: typeof req.query.month });
    });
    const res = await request(app).get('/query?month=3');
    expect(res.status).toBe(200);
    expect(res.body.month).toBe(3);
    expect(res.body.type).toBe('number');
  });

  it('rejects an out-of-range query value', async () => {
    const app = buildApp((_req, res) => res.json({}));
    const res = await request(app).get('/query?month=13');
    expect(res.status).toBe(400);
  });
});
