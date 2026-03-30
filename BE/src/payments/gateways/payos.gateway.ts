import { Injectable } from '@nestjs/common';
import {
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
} from './payment.gateway';

// Correct: Named import
import { PayOS } from '@payos/node';

@Injectable()
export class PayosGateway implements PaymentGateway {
  private payOS: PayOS | null;

  constructor() {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

    if (!clientId || !apiKey || !checksumKey) {
      this.payOS = null;
    } else {
      // PayOS constructor accepts an options object
      this.payOS = new PayOS({
        clientId,
        apiKey,
        checksumKey,
      });
    }
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      if (!this.payOS) {
        const frontendUrl =
          process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:3001';
        const errorMessage = encodeURIComponent(
          'PayOS chưa được cấu hình. Vui lòng kiểm tra PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong file .env',
        );

        return {
          paymentUrl: `${frontendUrl}/payment-result?success=false&message=${errorMessage}`,
          vnpTxnRef: `PAYOS_ERROR_${Date.now()}`,
        };
      }

      // Generate unique orderCode (must be a number)
      const orderCode = Number(Date.now().toString().slice(-9));

      // Return URL must point to BACKEND, not frontend
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const returnUrl = `${backendUrl}/payments/payos/return`;
      const cancelUrl = `${backendUrl}/payments/payos/return`;

      // PayOS requires description <= 25 characters
      let description = params.orderInfo || 'Thanh toan hoc phi';
      if (description.length > 25) {
        description = description.substring(0, 22) + '...';
      }

      const paymentData = {
        orderCode,
        amount: params.amount,
        description,
        returnUrl,
        cancelUrl,
      };

      // Use paymentRequests.create() method
      const response = await this.payOS.paymentRequests.create(paymentData);

      if (!response || !response.checkoutUrl) {
        throw new Error('PayOS did not return a valid checkout URL');
      }

      return {
        paymentUrl: response.checkoutUrl,
        vnpTxnRef: `PAYOS_${orderCode}`,
      };
    } catch (error: any) {
      throw error;
    }
  }
}
