import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import {
  ApprovalRequest,
  ApprovalRequestSchema,
} from './schemas/approval-request.schema';
import { UsersModule } from '../users/users.module';
import { ClassesModule } from '../classes/classes.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    UsersModule,
    ClassesModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: ApprovalRequest.name, schema: ApprovalRequestSchema },
    ]),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
