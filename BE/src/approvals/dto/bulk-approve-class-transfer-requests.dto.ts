import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BulkApproveClassTransferRequestsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  requestIds: string[];
}
