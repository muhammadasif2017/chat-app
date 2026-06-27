import { Params } from 'nestjs-pino';

export const loggerConfig: Params = {
  pinoHttp: {
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
    autoLogging: true,
    redact: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.refreshToken',
      'req.body.content',
    ],
  },
};
