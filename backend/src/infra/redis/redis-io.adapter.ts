import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();
    pubClient.on('error', (err) => this.logger.error(`Redis pub client error: ${err}`));
    subClient.on('error', (err) => this.logger.error(`Redis sub client error: ${err}`));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const config = this.app.get(ConfigService);
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
        credentials: true,
      },
    }) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }
}
