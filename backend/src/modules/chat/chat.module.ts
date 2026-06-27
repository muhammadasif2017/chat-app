import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { PresenceModule } from '../presence/presence.module.js';

@Module({
  imports: [JwtModule.register({}), ConversationsModule, MessagesModule, PresenceModule],
  providers: [ChatGateway],
})
export class ChatModule {}
