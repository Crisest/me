import { Request, Response, NextFunction, RequestHandler } from 'express';
// import { RequestWithUser } from '@/types/express';

export function withAuth(
  handler: (req: Request, res: Response, next: NextFunction) => any
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next);
  };
}
