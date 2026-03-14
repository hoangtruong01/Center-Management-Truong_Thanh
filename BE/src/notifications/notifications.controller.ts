import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Post()
  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Parent, UserRole.Student)
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Post('notify-admin')
  @Roles(UserRole.Admin, UserRole.Teacher, UserRole.Parent, UserRole.Student)
  notifyAdmin(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.notifyAdmins(dto);
  }

  @Get()
  list(@CurrentUser() user: UserDocument) {
    return this.notificationsService.listForUser(user);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: UserDocument) {
    return this.notificationsService.markAllRead(user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }

  @Delete()
  removeAll(@CurrentUser() user: UserDocument) {
    return this.notificationsService.removeAll(user);
  }
}
