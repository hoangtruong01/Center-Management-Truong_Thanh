import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import {
  ScheduleQueryDto,
  GenerateSessionsDto,
  CheckConflictDto,
  BulkCreateSessionsDto,
} from './dto/schedule-query.dto';
import { CancelAndMakeupSessionDto } from './dto/cancel-and-makeup-session.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @Roles(UserRole.Admin, UserRole.Teacher)
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(user, dto);
  }

  // Lấy lịch với filter
  @Get('schedule')
  getSchedule(@Query() query: ScheduleQueryDto) {
    return this.sessionsService.getSchedule(query);
  }

  // Lấy lịch của người dùng hiện tại (student hoặc teacher)
  @Get('my-sessions')
  getMySessions(@CurrentUser() user: UserDocument) {
    return this.sessionsService.getMySessions(user);
  }

  // Kiểm tra xung đột lịch
  @Post('check-conflict')
  @Roles(UserRole.Admin, UserRole.Teacher)
  checkConflict(@Body() dto: CheckConflictDto) {
    return this.sessionsService.checkConflict(dto);
  }

  // Tự động tạo sessions từ schedule của class
  @Post('generate')
  @Roles(UserRole.Admin)
  generateSessions(
    @CurrentUser() user: UserDocument,
    @Body() dto: GenerateSessionsDto,
  ) {
    return this.sessionsService.generateSessions(user, dto);
  }

  // Tạo nhiều sessions cùng lúc
  @Post('bulk')
  @Roles(UserRole.Admin, UserRole.Teacher)
  bulkCreate(
    @CurrentUser() user: UserDocument,
    @Body() dto: BulkCreateSessionsDto,
  ) {
    return this.sessionsService.bulkCreate(user, dto);
  }

  // Lấy lịch của giáo viên
  @Get('teacher/:teacherId')
  getTeacherSchedule(
    @Param('teacherId') teacherId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.sessionsService.getTeacherSchedule(
      teacherId,
      startDate,
      endDate,
    );
  }

  // Lấy lịch của học sinh
  @Get('student/:studentId')
  getStudentSchedule(
    @Param('studentId') studentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.sessionsService.getStudentSchedule(
      studentId,
      startDate,
      endDate,
    );
  }

  // Thống kê sessions
  @Get('statistics')
  @Roles(UserRole.Admin)
  getStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.sessionsService.getStatistics(startDate, endDate, branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionsService.findById(id);
  }

  @Get()
  find(@Query('classId') classId?: string) {
    if (classId) return this.sessionsService.findByClass(classId);
    return this.sessionsService.findAll();
  }

  @Patch(':id')
  @Roles(UserRole.Admin, UserRole.Teacher)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.sessionsService.update(id, dto, user);
  }

  @Post(':id/cancel-and-makeup')
  @Roles(UserRole.Admin)
  cancelAndMakeup(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
    @Body() dto: CancelAndMakeupSessionDto,
  ) {
    return this.sessionsService.cancelAndCreateMakeupSession(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.Admin)
  remove(@Param('id') id: string) {
    return this.sessionsService.remove(id);
  }
}
