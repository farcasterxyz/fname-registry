import { ENVIRONMENT } from './env.js';
import pino from 'pino';

export const log = pino({
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(ENVIRONMENT === 'dev'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }
    : {}),
});

export type Logger = pino.Logger;
