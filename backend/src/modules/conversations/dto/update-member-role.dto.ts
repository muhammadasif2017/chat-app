import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: ['ADMIN', 'MEMBER'],
    example: 'ADMIN',
    description: 'Owner cannot be changed via this endpoint',
  })
  @IsEnum(['ADMIN', 'MEMBER'], { message: 'role must be ADMIN or MEMBER' })
  role: 'ADMIN' | 'MEMBER';
}
