import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  Ip,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, ConfirmCashPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ==================== CREATE PAYMENT ====================

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Student, UserRole.Parent)
  async createPayment(
    @Request() req,
    @Body() dto: CreatePaymentDto,
    @Ip() ip: string,
  ) {
    const ipAddr = ip || '127.0.0.1';
    return this.paymentsService.createPayment(
      dto,
      req.user._id,
      req.user.role,
      ipAddr,
    );
  }

  // ==================== PAYOS ====================

  @Get('payos/return')
  async payosReturn(
    @Query() queryParams: Record<string, any>,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.handlePayosReturn(queryParams);

    const frontendUrl =
      process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3001';
    const redirectUrl = `${frontendUrl}/payment-result?success=${result.success}&paymentId=${result.paymentId}&message=${encodeURIComponent(result.message)}`;

    return res.redirect(redirectUrl);
  }

  @Post('payos/webhook')
  async payosWebhook(@Body() webhookData: any) {
    console.log('PayOS Webhook endpoint hit');
    return this.paymentsService.handlePayosWebhook(webhookData);
  }

  // ==================== FAKE PAYOS ====================

  @Post('fake/callback')
  async fakePayosCallback(
    @Body() body: { paymentId: string; status: 'SUCCESS' | 'CANCELLED' },
  ) {
    return this.paymentsService.handleFakePayosCallback(
      body.paymentId,
      body.status,
    );
  }

  // ==================== CASH ====================

  @Post('cash/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  async confirmCashPayment(@Request() req, @Body() dto: ConfirmCashPaymentDto) {
    return this.paymentsService.confirmCashPayment(dto, req.user._id);
  }

  @Get('cash/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  async getPendingCashPayments() {
    return this.paymentsService.findPendingCashPayments();
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  async getAllPayments() {
    return this.paymentsService.getAllPayments();
  }

  @Get('admin/finance-overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  async getFinanceOverview(
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    return this.paymentsService.getFinanceOverview(from, to);
  }

  // ==================== COMMON ====================

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Student, UserRole.Parent)
  async getMyPayments(@Request() req) {
    return this.paymentsService.findByUser(req.user._id, req.user.role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }
}
