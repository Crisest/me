import { Request, Response, NextFunction } from 'express';
import { createRequestLogger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      log: any;
      startTime?: number;
    }
  }
}

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const log = createRequestLogger({
    method: req.method,
    url: req.url,
    ip: req.ip,
  });

  req.log = log;
  req.startTime = Date.now();

  log.info({ req }, 'Request received');

  res.on('finish', () => {
    const responseTime = Date.now() - (req.startTime || Date.now());
    log.info(
      {
        res,
        statusCode: res.statusCode,
        responseTime,
      },
      'Request completed'
    );
  });

  next();
};
