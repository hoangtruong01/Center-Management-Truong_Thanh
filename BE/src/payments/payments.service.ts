import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Payment,
  PaymentDocument,
  PaymentMethod,
  PaymentStatus,
} from './schemas/payment.schema';
import {
  PaymentTransaction,
  PaymentTransactionDocument,
  TransactionType,
} from './schemas/payment-transaction.schema';
import { PaymentRequestsService } from '../payment-requests/payment-requests.service';
import { CreatePaymentDto, ConfirmCashPaymentDto } from './dto/payment.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { PaymentGatewayFactory } from './gateways/gateway.factory';
import { ChatGateway } from '../chat/chat.gateway';

interface PayosWebhookPayload {
  code?: string;
  desc?: string;
  data?: {
    orderCode?: string | number;
    reference?: string;
    transactionDateTime?: string;
    [key: string]: unknown;
  };
  signature?: string;
  [key: string]: unknown;
}

interface PayosReturnQuery {
  code?: string;
  orderCode?: string;
  status?: string;
  cancel?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(PaymentTransaction.name)
    private transactionModel: Model<PaymentTransactionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private paymentRequestsService: PaymentRequestsService,
    private gatewayFactory: PaymentGatewayFactory,
    private chatGateway: ChatGateway,
  ) {}

  // ==================== CREATE PAYMENT ====================

  async createPayment(
    dto: CreatePaymentDto,
    userId: string,
    userRole: string,
    ipAddr: string,
  ): Promise<{
    paymentId: string;
    paymentUrl?: string;
    checkoutUrl?: string;
    vnpTxnRef?: string;
    message?: string;
  }> {
    // 1. Xác định studentId
    let studentId = userId;
    if (userRole === 'parent' && dto.studentId) {
      studentId = dto.studentId;
    }

    // 2. Validate requests
    const { requests, totalAmount } =
      await this.paymentRequestsService.validateRequestsForPayment(
        dto.requestIds,
        studentId,
      );

    if (totalAmount <= 0) {
      throw new BadRequestException('Tổng số tiền phải lớn hơn 0');
    }

    // 3. Fetch student để lấy branchId snapshot
    const student = await this.userModel.findById(studentId).lean();
    if (!student) {
      throw new NotFoundException('Không tìm thấy học sinh');
    }

    // Fetch branch để lấy branchName
    let branchId: Types.ObjectId | null = null;
    let branchName: string | null = null;
    if (student.branchId) {
      const branch = await this.branchModel.findById(student.branchId).lean();
      if (branch) {
        branchId = new Types.ObjectId(student.branchId);
        branchName = branch.name;
      }
    }

    // Snapshot subject names from requests
    const subjects = requests
      .map((request) => request.classSubject)
      .filter((subject): subject is string => Boolean(subject));
    const subjectName = [...new Set(subjects)].join(', ');

    // 4. Tạo payment record
    const isCash = dto.method === PaymentMethod.CASH;
    const initialStatus = isCash
      ? PaymentStatus.PENDING_CASH
      : PaymentStatus.PENDING;

    const payment = new this.paymentModel({
      requestIds: dto.requestIds.map((id) => new Types.ObjectId(id)),
      paidBy: new Types.ObjectId(userId),
      studentId: new Types.ObjectId(studentId),
      amount: totalAmount,
      method: dto.method,
      status: initialStatus,
      branchId: branchId ? new Types.ObjectId(branchId) : null,
      branchName: branchName,
      subjectName: subjectName || undefined,
    });

    // 5. Gateway Factory Logic
    console.log(
      `PaymentsService requesting gateway for method: '${dto.method}'`,
    );
    const gateway = this.gatewayFactory.getByMethod(dto.method);
    console.log(
      `Gateway obtained: ${gateway ? gateway.constructor.name : 'null'}`,
    );

    if (gateway) {
      // PAYOS or FAKE
      const orderInfo = `Thanh toan hoc phi - ${requests.length} yeu cau`;
      const result = await gateway.createPayment({
        orderId: (payment._id as Types.ObjectId).toString(),
        amount: totalAmount,
        orderInfo,
        ipAddr,
        requestIds: dto.requestIds,
      });

      payment.vnpTxnRef = result.vnpTxnRef;
      await payment.save();

      await this.logTransaction(
        payment._id as Types.ObjectId,
        TransactionType.CREATE,
        { ...result, amount: totalAmount, requestIds: dto.requestIds },
        `Created ${dto.method} payment`,
      );

      return {
        paymentId: (payment._id as Types.ObjectId).toString(),
        ...result,
      };
    } else {
      // CASH (Gateway is null)
      await payment.save();

      await this.logTransaction(
        payment._id as Types.ObjectId,
        TransactionType.CREATE,
        { amount: totalAmount, requestIds: dto.requestIds },
        'Created cash payment request',
      );

      return {
        paymentId: (payment._id as Types.ObjectId).toString(),
        message: 'Vui lòng đến quầy thu ngân để thanh toán',
      };
    }
  }

  // ==================== PAYOS HANDLERS ====================

  async handlePayosWebhook(
    webhookData: PayosWebhookPayload,
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('PayOS Webhook received:', webhookData);

      // PayOS webhook structure: { code, desc, data: { orderCode, amount, ... }, signature }
      if (!webhookData.data || !webhookData.data.orderCode) {
        throw new BadRequestException('Invalid webhook data');
      }

      const { orderCode, reference, transactionDateTime } = webhookData.data;

      // Find payment by orderCode (stored in vnpTxnRef as PAYOS_{orderCode})
      const payment = await this.paymentModel.findOne({
        vnpTxnRef: `PAYOS_${orderCode}`,
      });

      if (!payment) {
        console.error('Payment not found for orderCode:', orderCode);
        return { success: false, message: 'Payment not found' };
      }

      // Idempotent check
      if (payment.status === PaymentStatus.SUCCESS) {
        return { success: true, message: 'Already processed' };
      }

      // Update payment status
      payment.status = PaymentStatus.SUCCESS;
      payment.paidAt = transactionDateTime
        ? new Date(transactionDateTime)
        : new Date();
      payment.vnpTransactionNo = reference || `PAYOS_${orderCode}`;
      await payment.save();

      // Mark requests as paid
      await this.paymentRequestsService.markAsPaid(
        payment.requestIds.map((id) => id.toString()),
        payment._id as Types.ObjectId,
      );

      await this.emitPaymentStatusUpdated(payment);

      // Log transaction
      await this.logTransaction(
        payment._id as Types.ObjectId,
        TransactionType.IPN,
        webhookData,
        'PayOS Webhook: SUCCESS',
      );

      console.log('PayOS payment processed successfully:', payment._id);

      return { success: true, message: 'Payment confirmed' };
    } catch (error) {
      console.error('PayOS Webhook Error:', error);
      throw error;
    }
  }

  async handlePayosReturn(
    queryParams: PayosReturnQuery,
  ): Promise<{ success: boolean; paymentId: string; message: string }> {
    try {
      console.log('PayOS Return URL params:', queryParams);

      // PayOS return URL có: code, id, cancel, status, orderCode
      const { code, orderCode, status, cancel } = queryParams;

      if (!orderCode) {
        return { success: false, paymentId: '', message: 'Missing orderCode' };
      }

      const payment = await this.paymentModel.findOne({
        vnpTxnRef: `PAYOS_${orderCode}`,
      });

      if (!payment) {
        return {
          success: false,
          paymentId: '',
          message: 'Không tìm thấy giao dịch',
        };
      }

      // Check if cancelled
      if (cancel === 'true') {
        payment.status = PaymentStatus.CANCELLED;
        payment.failReason = 'User cancelled';
        await payment.save();

        await this.logTransaction(
          payment._id as Types.ObjectId,
          TransactionType.RETURN_URL,
          queryParams,
          'PayOS Return: CANCELLED',
        );

        return {
          success: false,
          paymentId: (payment._id as Types.ObjectId).toString(),
          message: 'Giao dịch đã bị hủy',
        };
      }

      // If status === 'PAID' or code === '00', mark as success (webhook will confirm later)
      if (status === 'PAID' || code === '00') {
        payment.status = PaymentStatus.SUCCESS;
        payment.paidAt = new Date();
        await payment.save();

        await this.paymentRequestsService.markAsPaid(
          payment.requestIds.map((id) => id.toString()),
          payment._id as Types.ObjectId,
        );

        await this.emitPaymentStatusUpdated(payment);

        await this.logTransaction(
          payment._id as Types.ObjectId,
          TransactionType.RETURN_URL,
          queryParams,
          'PayOS Return: SUCCESS',
        );

        return {
          success: true,
          paymentId: (payment._id as Types.ObjectId).toString(),
          message: 'Thanh toán thành công',
        };
      }

      // Pending or other status
      return {
        success: false,
        paymentId: (payment._id as Types.ObjectId).toString(),
        message: 'Đang xử lý giao dịch',
      };
    } catch (error) {
      console.error('PayOS Return Error:', error);
      throw error;
    }
  }

  // ==================== FAKE PAYOS HANDLERS ====================

  async handleFakePayosCallback(
    paymentId: string,
    status: 'SUCCESS' | 'CANCELLED',
  ): Promise<{ success: boolean; message: string }> {
    const payment = await this.paymentModel.findById(paymentId);

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }

    if (payment.method !== PaymentMethod.FAKE) {
      throw new BadRequestException('Không phải giao dịch Fake PayOS');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { success: true, message: 'Giao dịch đã thành công trước đó' };
    }

    await this.logTransaction(
      payment._id as Types.ObjectId,
      TransactionType.IPN,
      { status, paymentId },
      `Fake PayOS Callback: ${status}`,
    );

    if (status === 'SUCCESS') {
      payment.status = PaymentStatus.SUCCESS;
      payment.paidAt = new Date();
      payment.vnpTransactionNo = `FAKE_TXN_${Date.now()}`;
      await payment.save();

      // Mark requests as paid
      await this.paymentRequestsService.markAsPaid(
        payment.requestIds.map((id) => id.toString()),
        payment._id as Types.ObjectId,
      );

      await this.emitPaymentStatusUpdated(payment);

      return { success: true, message: 'Thanh toán thành công (Fake)' };
    } else {
      payment.status = PaymentStatus.CANCELLED;
      payment.failReason = 'User cancelled implementation';
      await payment.save();
      return { success: false, message: 'Đã huỷ giao dịch' };
    }
  }

  // ==================== CASH HANDLERS ====================

  async confirmCashPayment(
    dto: ConfirmCashPaymentDto,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    const payment = await this.paymentModel.findById(dto.paymentId);

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }

    if (payment.method !== PaymentMethod.CASH) {
      throw new BadRequestException('Giao dịch này không phải tiền mặt');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { success: true, message: 'Giao dịch đã được xác nhận trước đó' };
    }

    if (payment.status !== PaymentStatus.PENDING_CASH) {
      throw new BadRequestException(
        'Giao dịch không ở trạng thái chờ xác nhận',
      );
    }

    // Update payment
    payment.status = PaymentStatus.SUCCESS;
    payment.confirmedBy = new Types.ObjectId(adminId);
    payment.confirmedAt = new Date();
    payment.paidAt = new Date();
    await payment.save();

    // Mark requests as paid
    await this.paymentRequestsService.markAsPaid(
      payment.requestIds.map((id) => id.toString()),
      payment._id as Types.ObjectId,
    );

    await this.emitPaymentStatusUpdated(payment);

    await this.logTransaction(
      payment._id as Types.ObjectId,
      TransactionType.CASH_CONFIRM,
      { adminId },
      'Cash payment confirmed',
      new Types.ObjectId(adminId),
    );

    return { success: true, message: 'Đã xác nhận thanh toán thành công' };
  }

  async findPendingCashPayments(): Promise<Payment[]> {
    return this.paymentModel
      .find({
        method: PaymentMethod.CASH,
        status: PaymentStatus.PENDING_CASH,
      })
      .populate('studentId', 'name email studentCode')
      .populate('paidBy', 'name email')
      .sort({ createdAt: -1 });
  }

  // ==================== COMMON ====================

  async findByStudent(studentId: string): Promise<Payment[]> {
    return this.paymentModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ createdAt: -1 });
  }

  async findByUser(userId: string, userRole: string): Promise<Payment[]> {
    if (userRole === 'parent') {
      const parent = await this.userModel.findById(userId).lean();
      if (!parent) {
        return [];
      }

      const childIds = new Set<string>();

      if (Array.isArray(parent.childrenIds)) {
        parent.childrenIds.forEach((id) => {
          if (id) {
            childIds.add(id.toString());
          }
        });
      }

      if (parent.childEmail) {
        const child = await this.userModel
          .findOne({ email: parent.childEmail })
          .lean();
        if (child?._id) {
          childIds.add((child._id as Types.ObjectId).toString());
        }
      }

      const studentObjectIds = Array.from(childIds)
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      return this.paymentModel
        .find({
          $or: [
            { paidBy: new Types.ObjectId(userId) },
            ...(studentObjectIds.length > 0
              ? [{ studentId: { $in: studentObjectIds } }]
              : []),
          ],
        })
        .sort({ createdAt: -1 });
    }

    return this.findByStudent(userId);
  }

  async getAllPayments(): Promise<Payment[]> {
    return this.paymentModel
      .find()
      .populate('studentId', 'name email studentCode')
      .populate('paidBy', 'name email')
      .sort({ createdAt: -1 });
  }

  async getFinanceOverview(
    fromDate?: Date,
    toDate?: Date,
  ): Promise<{
    summary: {
      totalRevenue: number;
      totalPaymentsCount: number;
      vnpayRevenue: number;
      cashRevenue: number;
      scholarshipRevenue: number;
      previousPeriodRevenue?: number;
      growthRate?: number;
    };
    monthlyData: Array<{
      month: string;
      revenue: number;
      count: number;
    }>;
    byMethod: {
      vnpay_test: number;
      cash: number;
      scholarship: number;
    };
  }> {
    // Default: last 6 months if no date range specified
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const from = fromDate || sixMonthsAgo;
    const to = toDate || now;

    // Match only successful payments
    // Note: Some payments might not have paidAt, so we'll use $or with createdAt
    const matchStage = {
      status: PaymentStatus.SUCCESS,
      $or: [
        { paidAt: { $gte: from, $lte: to } },
        { paidAt: { $exists: false }, createdAt: { $gte: from, $lte: to } },
      ],
    };

    // Aggregate by month - use paidAt if exists, otherwise createdAt
    const monthlyStats = await this.paymentModel.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          effectiveDate: {
            $ifNull: ['$paidAt', '$createdAt'],
          },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$effectiveDate' } },

          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Debug logging
    console.log('=== FINANCE OVERVIEW DEBUG ===');
    console.log('Date range:', { from, to });
    console.log('Match stage:', JSON.stringify(matchStage, null, 2));

    // Count total SUCCESS payments
    const totalSuccessCount = await this.paymentModel.countDocuments({
      status: PaymentStatus.SUCCESS,
    });
    console.log('Total SUCCESS payments in DB:', totalSuccessCount);
    console.log('Monthly stats result:', monthlyStats);

    // Aggregate by method

    const methodStats = await this.paymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$method',
          revenue: { $sum: '$amount' },
        },
      },
    ]);

    // Total stats
    const totalStats = await this.paymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    // Calculate previous period for growth rate
    const periodDiff = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - periodDiff);
    const previousTo = from;

    const previousStats = await this.paymentModel.aggregate([
      {
        $match: {
          status: PaymentStatus.SUCCESS,
          $or: [
            { paidAt: { $gte: previousFrom, $lt: previousTo } },
            {
              paidAt: { $exists: false },
              createdAt: { $gte: previousFrom, $lt: previousTo },
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
        },
      },
    ]);

    const total = totalStats[0] || { totalRevenue: 0, totalCount: 0 };
    const previousRevenue = previousStats[0]?.totalRevenue || 0;
    const growthRate =
      previousRevenue > 0
        ? ((total.totalRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

    // Build byMethod object
    const byMethod = {
      vnpay_test: 0,
      cash: 0,
      scholarship: 0,
    };

    methodStats.forEach((stat) => {
      if (stat._id in byMethod) {
        byMethod[stat._id as keyof typeof byMethod] = stat.revenue;
      }
    });

    const result = {
      summary: {
        totalRevenue: total.totalRevenue,
        totalPaymentsCount: total.totalCount,
        vnpayRevenue: byMethod.vnpay_test,
        cashRevenue: byMethod.cash,
        scholarshipRevenue: byMethod.scholarship,
        previousPeriodRevenue: previousRevenue,
        growthRate: Math.round(growthRate * 100) / 100,
      },
      monthlyData: monthlyStats.map((stat) => ({
        month: stat._id,
        revenue: stat.revenue,
        count: stat.count,
      })),
      byMethod,
    };

    console.log('Final result:', JSON.stringify(result, null, 2));
    console.log('==============================\n');

    return result;
  }

  private async logTransaction(
    paymentId: Types.ObjectId,
    type: TransactionType,
    rawData: Record<string, unknown>,
    message: string,
    performedBy?: Types.ObjectId,
  ): Promise<void> {
    const transaction = new this.transactionModel({
      paymentId,
      type,
      rawData,
      message,
      performedBy,
    });
    await transaction.save();
  }

  private async emitPaymentStatusUpdated(
    payment: PaymentDocument,
  ): Promise<void> {
    try {
      const server = this.chatGateway?.server;
      if (!server) {
        return;
      }

      const targetUserIds = new Set<string>();
      if (payment.studentId) {
        targetUserIds.add(payment.studentId.toString());
      }
      if (payment.paidBy) {
        targetUserIds.add(payment.paidBy.toString());
      }

      const payload = {
        paymentId: (payment._id as Types.ObjectId).toString(),
        status: payment.status,
        method: payment.method,
        studentId: payment.studentId?.toString(),
        paidBy: payment.paidBy?.toString(),
        requestIds: payment.requestIds.map((id) => id.toString()),
        paidAt: payment.paidAt?.toISOString(),
        updatedAt: new Date().toISOString(),
      };

      targetUserIds.forEach((userId) => {
        server.to(`user_${userId}`).emit('paymentStatusUpdated', payload);
      });
    } catch (error) {
      console.error('Emit paymentStatusUpdated error:', error);
    }
  }

  // ==================== FIND BY ID (for mobile polling) ====================

  async findById(id: string): Promise<PaymentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Payment not found');
    }
    const payment = await this.paymentModel
      .findById(id)
      .populate('paidBy', 'name email fullName')
      .populate('studentId', 'name fullName')
      .exec();

    if (!payment) {
      throw new NotFoundException(`Payment ${id} not found`);
    }
    return payment;
  }
}
