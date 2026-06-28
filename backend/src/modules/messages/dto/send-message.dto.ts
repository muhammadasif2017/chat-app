import { IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'b6b4c3e2-1234-4567-8901-abcdef012345' })
  @IsUUID()
  conversationId: string;

  @ApiProperty({ example: 'Hello, world!', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content: string;

  @ApiPropertyOptional({ example: 42, description: 'ID of the message being replied to' })
  @IsOptional()
  @IsInt()
  replyToId?: number;

  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE', 'FILE'], default: 'TEXT' })
  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'FILE'])
  type?: 'TEXT' | 'IMAGE' | 'FILE';

  @ApiPropertyOptional({
    example: { url: 'https://example.com/img.png' },
    description: 'Extra data for IMAGE/FILE messages',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
