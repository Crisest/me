import bunyan from 'bunyan';
import { ulid } from 'ulid';
import { config } from '../config/env';

const logger = bunyan.createLogger({
  name: 'portfolio-api',
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  serializers: bunyan.stdSerializers,
});

export interface LogContext {
  sequenceId?: string;
  [key: string]: any;
}

export const createRequestLogger = (context: LogContext = {}) => {
  const sequenceId = context.sequenceId || ulid();
  return logger.child({ sequenceId, ...context });
};

export default logger;
