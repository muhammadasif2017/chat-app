import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ConversationType } from '@prisma/client';

export class CreateConversationDto {
  @IsEnum(['GROUP', 'CHANNEL'])
  type: ConversationType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  isPublic?: boolean;
}
