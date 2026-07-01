import { IsNotEmpty, IsNumberString, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditMessageDto {
  @ApiProperty({ example: '42', description: 'Numeric message ID as string' })
  @IsNumberString()
  messageId: string;

  @ApiProperty({ example: 'Updated message content', maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}
