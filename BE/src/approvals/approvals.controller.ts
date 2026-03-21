import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { ApproveUserDto } from './dto/approve-user.dto';
import type { RequestWithUser } from '../common/interfaces/request-with-user';
import { CreateClassTransferRequestDto } from './dto/create-class-transfer-request.dto';
import { RejectClassTransferRequestDto } from './dto/reject-class-transfer-request.dto';
import { BulkApproveClassTransferRequestsDto } from './dto/bulk-approve-class-transfer-requests.dto';
import { BulkRejectClassTransferRequestsDto } from './dto/bulk-reject-class-transfer-requests.dto';
import { ApprovalStatus } from './schemas/approval-request.schema';

@ApiTags('admin-approvals')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('approvals')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Danh sách approval pending' })
  list() {
    return this.approvalsService.listPending();
  }

  @Post('approve-user')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Duyệt user đăng ký -> status ACTIVE' })
  approve(@Body() dto: ApproveUserDto, @Req() req: RequestWithUser) {
    return this.approvalsService.approveRegister(
      dto.userId,
      (req.user as any)?._id?.toString(),
    );
  }

  @Get('class-transfer-requests')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Danh sách yêu cầu chuyển lớp' })
  listClassTransferRequests(
    @Query('status') status?: ApprovalStatus,
    @Query('q') q?: string,
  ) {
    return this.approvalsService.listClassTransferRequests(status, q);
  }

  @Post('class-transfer-requests')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Tạo yêu cầu chuyển lớp (chờ duyệt)' })
  createClassTransferRequest(
    @Body() dto: CreateClassTransferRequestDto,
    @Req() req: RequestWithUser,
  ) {
    return this.approvalsService.createClassTransferRequest(
      dto,
      (req.user as any)?._id?.toString(),
    );
  }

  @Post('class-transfer-requests/:id/approve')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Duyệt yêu cầu chuyển lớp' })
  approveClassTransferRequest(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.approvalsService.approveClassTransferRequest(
      id,
      (req.user as any)?._id?.toString(),
    );
  }

  @Post('class-transfer-requests/:id/reject')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Từ chối yêu cầu chuyển lớp' })
  rejectClassTransferRequest(
    @Param('id') id: string,
    @Body() dto: RejectClassTransferRequestDto,
    @Req() req: RequestWithUser,
  ) {
    return this.approvalsService.rejectClassTransferRequest(
      id,
      (req.user as any)?._id?.toString(),
      dto.reason,
    );
  }

  @Post('class-transfer-requests/bulk-approve')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Duyệt hàng loạt yêu cầu chuyển lớp' })
  bulkApproveClassTransferRequests(
    @Body() dto: BulkApproveClassTransferRequestsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.approvalsService.bulkApproveClassTransferRequests(
      dto.requestIds,
      (req.user as any)?._id?.toString(),
    );
  }

  @Post('class-transfer-requests/bulk-reject')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: 'Từ chối hàng loạt yêu cầu chuyển lớp' })
  bulkRejectClassTransferRequests(
    @Body() dto: BulkRejectClassTransferRequestsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.approvalsService.bulkRejectClassTransferRequests(
      dto.requestIds,
      (req.user as any)?._id?.toString(),
      dto.reason,
    );
  }
}
