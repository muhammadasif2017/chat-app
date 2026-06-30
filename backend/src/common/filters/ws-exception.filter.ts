import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

@Catch(WsException, HttpException)
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: WsException | HttpException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const message =
      exception instanceof HttpException
        ? ((exception.getResponse() as { message?: string | string[] }).message ??
          exception.message)
        : exception.message;
    client.emit('error', { message });
  }
}
