import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClassTransferRequestDto {
  @IsMongoId()
  studentId: string;

  @IsMongoId()
  fromClassId: string;

  @IsMongoId()
  toClassId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
