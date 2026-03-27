import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './schemas/payment-transaction.schema';
import { PaymentRequestsModule } from '../payment-requests/payment-requests.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { ChatModule } from '../chat/chat.module';

import { PayosGateway } from './gateways/payos.gateway';
import { PaymentGatewayFactory } from './gateways/gateway.factory';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    PaymentRequestsModule,
    ChatModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PayosGateway, PaymentGatewayFactory],
  exports: [PaymentsService],
})
export class PaymentsModule {}
