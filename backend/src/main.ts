// pg-types returns BigInt as strings via pg; patch to guard against future behaviour changes
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint) {
  return this.toString();
};

import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { join, basename } from 'path';
import { AppModule } from './app.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { RedisIoAdapter } from './infra/redis/redis-io.adapter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res: { setHeader: (key: string, value: string) => void }, filePath: string) => {
      res.setHeader('Content-Disposition', `attachment; filename="${basename(filePath)}"`);
    },
  });

  const config = app.get(ConfigService);

  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(config.get<string>('REDIS_URL')!);
  app.useWebSocketAdapter(redisAdapter);

  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Chat App API')
      .setDescription(
        'Real-time chat platform REST API. WebSocket events are documented in the README.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableCors({
    origin: config.get('FRONTEND_URL'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
void bootstrap();
