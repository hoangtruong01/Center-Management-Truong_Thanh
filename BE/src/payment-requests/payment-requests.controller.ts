import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentRequestsService } from './payment-requests.service';
import { CreateClassPaymentRequestDto } from './dto/create-class-payment-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { StudentPaymentRequestStatus } from './schemas/student-payment-request.schema';

@ApiTags('Payment Requests')
@ApiBearerAuth()
@Controller('payment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentRequestsController {
  constructor(private readonly service: PaymentRequestsService) {}

  // ==================== ADMIN ENDPOINTS ====================

  @Post('class')
  @Roles(UserRole.Admin)
  async createClassPaymentRequest(
    @Request() req,
    @Body() dto: CreateClassPaymentRequestDto,
  ) {
    return this.service.createClassPaymentRequest(dto, req.user._id);
  }

  @Get('class')
  @Roles(UserRole.Admin)
  async getClassPaymentRequests(@Query('classId') classId?: string) {
    return this.service.getClassPaymentRequests(classId);
  }

  @Get('class/:classRequestId/students')
  @Roles(UserRole.Admin)
  async getClassRequestStudents(
    @Param('classRequestId') classRequestId: string,
  ) {
    return this.service.getStudentsByClassRequest(classRequestId);
  }

  @Delete('class/:id')
  @Roles(UserRole.Admin)
  async cancelClassRequest(@Param('id') id: string) {
    return this.service.cancelClassPaymentRequest(id);
  }

  @Patch('class/:id/exception/approve')
  @Roles(UserRole.Admin)
  async approveClassRequestException(@Param('id') id: string, @Request() req) {
    return this.service.approveException(id, req.user._id);
  }

  @Patch('class/:id/exception/reject')
  @Roles(UserRole.Admin)
  async rejectClassRequestException(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { reason?: string },
  ) {
    return this.service.rejectException(id, req.user._id, body?.reason);
  }

  @Get('my')
  @Roles(UserRole.Student)
  async getMyPaymentRequests(@Request() req) {
    return this.service.getStudentPaymentRequests(req.user._id);
  }

  @Get('my/all')
  @Roles(UserRole.Student)
  async getAllMyPaymentRequests(@Request() req) {
    return this.service.getAllStudentPaymentRequests(req.user._id);
  }

  @Get('my/pending')
  @Roles(UserRole.Student)
  async getMyPendingRequests(@Request() req) {
    return this.service.getStudentPaymentRequests(
      req.user._id,
      StudentPaymentRequestStatus.PENDING,
    );
  }

  @Get('my-children')
  @Roles(UserRole.Parent)
  async getChildrenPaymentRequests(@Request() req) {
    return this.service.getChildrenPaymentRequests(req.user._id);
  }

  @Get('child/:studentId')
  @Roles(UserRole.Parent)
  async getChildPaymentRequests(@Param('studentId') studentId: string) {
    return this.service.getStudentPaymentRequests(studentId);
  }

  // ==================== COMMON ====================

  @Get(':id')
  async getStudentPaymentRequestById(@Param('id') id: string) {
    return this.service.getStudentPaymentRequestById(id);
  }
}
