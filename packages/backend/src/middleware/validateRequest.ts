import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ZodType, ZodError } from 'zod';
import { AppError } from './errorHandler';

export const validateRequest = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors: string[] = [];
    errors.array().map(err => extractedErrors.push(err.msg));

    next(new AppError(extractedErrors.join(', '), 400));
  };
};

const formatIssues = (err: ZodError): string =>
  err.issues
    .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join(', ');

type Source = 'body' | 'query' | 'params';

const validate =
  (source: Source) =>
  <T>(schema: ZodType<T>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError(formatIssues(result.error), 400));
    }
    // Replace the raw input with the parsed value so downstream handlers get
    // coerced types (numbers, Dates) rather than the original strings.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
    });
    next();
  };

export const validateBody = validate('body');
export const validateQuery = validate('query');
export const validateParams = validate('params');
