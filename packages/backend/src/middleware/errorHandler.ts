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
