import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'alice', minLength: 2, maxLength: 30 })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(30)
  username?: string;

  @ApiPropertyOptional()
  @IsUrl({ require_tld: false })
  @IsOptional()
  avatarUrl?: string;
}
