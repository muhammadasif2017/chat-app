import { IsNotEmpty, IsNumberString, IsString, IsUUID, MaxLength } from 'class-validator';

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
  @IsNotEmpty()
  @MaxLength(10)
  emoji: string;
}
