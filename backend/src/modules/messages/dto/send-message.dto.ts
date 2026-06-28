import { IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsInt()
  replyToId?: number;

  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE'])
  type?: 'TEXT' | 'IMAGE' | 'FILE';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
