import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationType } from '@prisma/client';

export class CreateConversationDto {
  @ApiProperty({ enum: ['GROUP', 'CHANNEL'], example: 'GROUP' })
  @IsEnum(['GROUP', 'CHANNEL'])
  type: ConversationType;

  @ApiProperty({ example: 'Engineering Team', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'All things engineering', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid-1', 'uuid-2'],
    description: 'UUIDs of initial members (up to 49)',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(49)
  @IsOptional()
  memberIds?: string[];
}
