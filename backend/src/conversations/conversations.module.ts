import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { ConversationsController } from './conversations.controller.js';

@Module({
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
