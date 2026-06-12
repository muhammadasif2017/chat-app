import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsEnum(['ADMIN', 'MEMBER'], { message: 'role must be ADMIN or MEMBER' })
  role: 'ADMIN' | 'MEMBER';
}
