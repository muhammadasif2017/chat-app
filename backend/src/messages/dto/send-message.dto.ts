import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @MaxLength(4000)
  content: string;

  @IsOptional()
  replyToId?: number;
}
