import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class BulkRejectClassTransferRequestsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  requestIds: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}
