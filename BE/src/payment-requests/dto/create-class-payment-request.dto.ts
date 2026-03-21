import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class CreateClassPaymentRequestDto {
  @IsNotEmpty()
  @IsString()
  classId: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number; // Nếu không truyền, lấy từ class.fee

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedCollectionRate?: number; // k in formulas, 0..1

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number; // C in formulas

  @IsOptional()
  @IsNumber()
  @Min(0)
  minProfitTarget?: number; // Pmin in formulas

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scholarshipCapPercent?: number; // Cap scholarship ratio in %

  @IsOptional()
  @IsString()
  @IsIn(['block', 'request_exception'])
  capExceedPolicy?: 'block' | 'request_exception';

  @IsOptional()
  @IsString()
  capExceedReason?: string;
}
