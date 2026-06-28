import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiProperty({
    example: 'b6b4c3e2-1234-4567-8901-abcdef012345',
    description: 'UUID of the user to add',
  })
  @IsUUID('4')
  userId: string;
}
