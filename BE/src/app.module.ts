import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { SessionsModule } from './sessions/sessions.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { GoalsModule } from './goals/goals.module';
import { TuitionModule } from './tuition/tuition.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { FeedbackModule } from './feedback/feedback.module';
import { InvitesModule } from './invites/invites.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { BranchesModule } from './branches/branches.module';
import { ImportsModule } from './imports/imports.module';
import { IncidentsModule } from './incidents/incidents.module';
import { PaymentRequestsModule } from './payment-requests/payment-requests.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { FinanceModule } from './finance/finance.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { GradesModule } from './grades/grades.module';
import { DocumentsModule } from './documents/documents.module';
import { AdminStatsModule } from './admin-stats/admin-stats.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    UsersModule,
    ClassesModule,
    SessionsModule,
    AttendanceModule,
    AssessmentsModule,
    AssignmentsModule,
    SubmissionsModule,
    GradesModule,
    GoalsModule,
    TuitionModule,
    NotificationsModule,
    ChatModule,
    FeedbackModule,
    InvitesModule,
    ApprovalsModule,
    BranchesModule,
    ImportsModule,
    IncidentsModule,
    PaymentRequestsModule,
    PaymentsModule,
    ExpensesModule,
    FinanceModule,
    DocumentsModule,
    AdminStatsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
