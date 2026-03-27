import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum MakeupConflictPolicy {
  BlockAll = 'block_all',
  AllowWithThreshold = 'allow_with_threshold',
  AllowWithManualResolution = 'allow_with_manual_resolution',
}

export class CancelAndMakeupSessionDto {
  @IsString()
  reason: string;

  @IsDateString()
  makeupStartTime: string;

  @IsDateString()
  makeupEndTime: string;

  @IsOptional()
  @IsEnum(MakeupConflictPolicy)
  policy?: MakeupConflictPolicy;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  maxConflictRate?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
