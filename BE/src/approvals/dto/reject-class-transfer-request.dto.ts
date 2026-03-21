import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectClassTransferRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
