import { PartialType } from '@nestjs/mapped-types';
import { CreateSessionDto } from './create-session.dto';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { SessionStatus } from './create-session.dto';

export class UpdateSessionDto extends PartialType(CreateSessionDto) {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsBoolean()
  conflictResolutionRequired?: boolean;

  @IsOptional()
  @IsEnum(['pending', 'resolved'])
  conflictResolutionStatus?: 'pending' | 'resolved';
}
