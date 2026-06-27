import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
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
  @MaxLength(500)
  description?: string;

  @IsOptional()
  isPublic?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(49)
  @IsOptional()
  memberIds?: string[];
}
