import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Post,
  Body,
  Req,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums/role.enum';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}
  
  @Roles(UserRole.Admin)

  @Get('dashboard')
  async getDashboard(
    @Query('branchId', new DefaultValuePipe('ALL')) branchId: string,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number,
  ) {
    return this.financeService.getDashboard(branchId, year);
  }

  @Get('class-health')
  async getClassHealth(
    @Query('branchId', new DefaultValuePipe('ALL')) branchId: string,
    @Query('risk', new DefaultValuePipe('all'))
    risk: 'all' | 'green' | 'yellow' | 'red',
  ) {
    return this.financeService.getClassFinancialHealth(branchId, risk);
  }

  @Roles(UserRole.Admin)
  @Get('weekly-class-report')
  async getWeeklyClassReport(
    @Query('branchId', new DefaultValuePipe('ALL')) branchId: string,
  ) {
    return this.financeService.getWeeklyClassFinancialReport(branchId);
  }

  @Roles(UserRole.Admin)
  @Post('payroll/payout')
  async notifyPayout(
    @Req() req: any,
    @Body() body: { teacherId: string; classId: string; blockNumber: number; amount: number },
  ) {
    return this.financeService.notifyTeacherPayout(
      req.user._id,
      body.teacherId,
      body.classId,
      body.blockNumber,
      body.amount,
    );
  }

  @Roles(UserRole.Teacher)
  @Post('payroll/confirm/:payoutId')
  async confirmPayout(@Req() req: any, @Param('payoutId') payoutId: string) {
    return this.financeService.confirmTeacherPayout(payoutId, req.user._id);
  }

  @Roles(UserRole.Teacher)
  @Get('payroll/my-payouts')
  async getMyPayouts(@Req() req: any) {
    return this.financeService.getTeacherPayouts(req.user._id);
  }
}
