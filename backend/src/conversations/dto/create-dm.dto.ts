import { IsUUID } from 'class-validator';

export class CreateDmDto {
  @IsUUID()
  targetUserId: string;
}
