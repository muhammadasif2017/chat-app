import { IsNumberString, IsString, IsUUID, MaxLength } from 'class-validator';

export class MessageIdDto {
  @IsNumberString()
  messageId: string;
}

export class ConversationIdDto {
  @IsUUID()
  conversationId: string;
}

export class ReactionDto {
  @IsNumberString()
  messageId: string;

  @IsString()
  @MaxLength(10)
  emoji: string;
}
