import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MessageMetadataDto {
  @IsUrl({ require_tld: false })
  url: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'b6b4c3e2-1234-4567-8901-abcdef012345' })
  @IsUUID()
  conversationId: string;

  @ApiProperty({ example: 'Hello, world!', maxLength: 4000, required: false })
  @ValidateIf((o) => o.type === 'TEXT' || !o.type)
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content?: string;

  @ApiPropertyOptional({ example: '42', description: 'ID of the message being replied to' })
  @IsOptional()
  @IsNumberString()
  replyToId?: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE', 'FILE'], default: 'TEXT' })
  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE'])
  type?: 'TEXT' | 'IMAGE' | 'FILE';

  @ApiPropertyOptional({
    example: { url: 'https://example.com/img.png' },
    description: 'Extra data for IMAGE/FILE messages',
  })
  @ValidateIf((o) => o.type === 'IMAGE' || o.type === 'FILE')
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => MessageMetadataDto)
  metadata?: MessageMetadataDto;
}
