import { Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { truncateAll, closeTestDb } from '../../test/setup';
import { errorHandler, AppError } from './errorHandler';

const buildReqRes = () => {
  const log = {
    child: jest.fn().mockReturnThis(),
    error: jest.fn(),
  };
  const req = { log } as unknown as Request;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status } as unknown as Response;
  const next = jest.fn();
  return { req, res, next, status, json };
};

describe('errorHandler', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    await truncateAll();
  });

  afterAll(closeTestDb);

  it('still maps a Postgres 22P02 SQLSTATE code to a 400 "Invalid identifier"', () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next, status, json } = buildReqRes();

    const pgError = new Error('invalid input syntax for type uuid') as Error & {
      code: string;
    };
    pgError.code = '22P02';

    errorHandler(pgError, req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      status: 'fail',
      message: 'Invalid identifier',
    });
  });

  it('maps a real drizzle foreign-key violation to a 400, not a 500', async () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next, status, json } = buildReqRes();

    let thrown: unknown;
    try {
      await db.insert(transactions).values({
        amount: 10,
        description: 'orphan transaction',
        createdBy: uuidv7(), // no matching user row -> FK violation
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeDefined();
    // Guard the premise of the fix: the SQLSTATE code from a real drizzle
    // error is not on the error itself but on its wrapped cause.
    expect((thrown as { code?: string }).code).toBeUndefined();
    expect((thrown as { cause?: { code?: string } }).cause?.code).toBe('23503');

    errorHandler(thrown as Error, req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      status: 'fail',
      message: 'Referenced resource does not exist',
    });
  });

  it('passes an AppError through unchanged', () => {
    process.env.NODE_ENV = 'production';
    const { req, res, next, status, json } = buildReqRes();

    errorHandler(new AppError('nope', 404), req, res, next);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ status: 'fail', message: 'nope' });
  });
});
