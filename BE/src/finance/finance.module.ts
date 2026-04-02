import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import {
  ClassPaymentRequest,
  ClassPaymentRequestSchema,
} from '../payment-requests/schemas/class-payment-request.schema';
import {
  StudentPaymentRequest,
  StudentPaymentRequestSchema,
} from '../payment-requests/schemas/student-payment-request.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import {
  TeacherPayout,
  TeacherPayoutSchema,
} from './schemas/teacher-payout.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: ClassPaymentRequest.name, schema: ClassPaymentRequestSchema },
      { name: StudentPaymentRequest.name, schema: StudentPaymentRequestSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: TeacherPayout.name, schema: TeacherPayoutSchema },
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
