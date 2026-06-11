import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { RedisIoAdapter } from './redis/redis-io.adapter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const config = app.get(ConfigService);

  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(config.get<string>('REDIS_URL')!);
  app.useWebSocketAdapter(redisAdapter);

  app.use(helmet());
  app.enableCors({
    origin: config.get('FRONTEND_URL'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  app.useGlobalFilters(new PrismaExceptionFilter());

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
void bootstrap();
