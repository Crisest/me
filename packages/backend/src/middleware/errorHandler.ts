import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  status: string;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // SQLSTATE codes surfaced by node-postgres. drizzle-orm wraps the raw pg
  // error, so the code can land on err.code (raw pg) or err.cause.code
  // (wrapped by drizzle) depending on the path the error took to get here.
  const pgCode =
    (err as unknown as { code?: string }).code ??
    (err as unknown as { cause?: { code?: string } }).cause?.code;
  if (pgCode === '22P02') {
    // invalid_text_representation — a malformed uuid reached a uuid column
    err = new AppError('Invalid identifier', 400);
  } else if (pgCode === '23503') {
    // foreign_key_violation
    err = new AppError('Referenced resource does not exist', 400);
  } else if (pgCode === '23505') {
    // unique_violation
    err = new AppError('Resource already exists', 409);
  } else if (pgCode === '23514') {
    // check_violation
    err = new AppError('Value violates a constraint', 400);
  }

  const statusCode = (err as AppError).statusCode || 500;
  const status = (err as AppError).status || 'error';

  const log = req.log.child({ component: 'errorHandler' });

  log.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        status,
        statusCode,
      },
    },
    'Error occurred while processing request'
  );

  if (process.env.NODE_ENV === 'development') {
    res.status(statusCode).json({
      status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // Production mode: don't leak error details
    res.status(statusCode).json({
      status,
      message: err.message,
    });
  }
};
