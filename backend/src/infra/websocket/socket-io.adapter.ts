import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import type { INestApplicationContext } from '@nestjs/common';
import { Server, ServerOptions } from 'socket.io';

export class SocketIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const config = this.app.get(ConfigService);
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000',
        credentials: true,
      },
    }) as Server;
  }
}
