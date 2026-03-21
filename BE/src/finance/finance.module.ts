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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: ClassPaymentRequest.name, schema: ClassPaymentRequestSchema },
      { name: StudentPaymentRequest.name, schema: StudentPaymentRequestSchema },
      { name: ClassEntity.name, schema: ClassSchema },
    ]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
