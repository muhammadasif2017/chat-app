import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    let message: string | string[];
    if (exception instanceof WsException) {
      message = exception.message;
    } else if (exception instanceof HttpException) {
      message =
        (exception.getResponse() as { message?: string | string[] }).message ?? exception.message;
    } else {
      this.logger.error(exception);
      message = 'Internal server error';
    }
    client.emit('error', { message });
  }
}
