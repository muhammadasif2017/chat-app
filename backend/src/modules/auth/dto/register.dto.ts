import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'alice', minLength: 2, maxLength: 30 })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  username: string;

  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'hunter2hunter2', minLength: 8, description: 'At least 8 characters' })
  @IsString()
  @MinLength(8)
  password: string;
}
