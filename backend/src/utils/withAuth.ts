import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RequestWithUser } from '@/types/express';

export function withAuth(
  handler: (req: RequestWithUser, res: Response, next: NextFunction) => any
): RequestHandler {
  return (req, res, next) => {
    handler(req as RequestWithUser, res, next);
  };
}
