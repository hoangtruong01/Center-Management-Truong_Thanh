import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Payment,
  PaymentDocument,
  PaymentStatus,
} from '../payments/schemas/payment.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import {
  ClassPaymentRequest,
  ClassPaymentRequestDocument,
  ClassPaymentRequestStatus,
} from '../payment-requests/schemas/class-payment-request.schema';
import { ClassEntity, ClassDocument } from '../classes/schemas/class.schema';
import {
  TeacherPayout,
  TeacherPayoutDocument,
  PayoutStatus,
} from './schemas/teacher-payout.schema';
import { NotificationsService } from '../notifications/notifications.service';

interface MonthlyData {
  month: number;
  revenue: number;
  expense: number;
  profit: number;
}

export interface DashboardResponse {
  branchId: string;
  year: number;
  summary: {
    totalRevenue: number;
    totalExpense: number;
    profit: number;
  };
  chart: {
    revenueByMonth: Array<{ month: number; amount: number }>;
    expenseByMonth: Array<{ month: number; amount: number }>;
  };
  revenueBySubject: Array<{ subject: string; amount: number }>;
  detailByMonth: MonthlyData[];
}

export interface ClassFinancialHealthItem {
  classRequestId: string;
  classId: string;
  className: string;
  classSubject?: string;
  status: string;
  dueDate?: Date;
  totalStudents: number;
  paidCount: number;
  paidRate: number;
  snapshot: {
    listedRevenue: number;
    scholarshipDiscountTotal: number;
    scholarshipDiscountRatio: number;
    estimatedRevenue: number;
    estimatedCost: number;
    projectedProfit: number;
    collectedRevenue: number;
    outstandingAmount: number;
    overdueDebtAmount: number;
    actualCollectionRate: number;
    actualProfit: number;
    minProfitTarget: number;
    riskLevel: 'green' | 'yellow' | 'red';
    isCapExceeded: boolean;
  };
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(ClassPaymentRequest.name)
    private classRequestModel: Model<ClassPaymentRequestDocument>,
    @InjectModel(ClassEntity.name)
    private classModel: Model<ClassDocument>,
    @InjectModel(TeacherPayout.name)
    private payoutModel: Model<TeacherPayoutDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDashboard(
    branchId: string,
    year: number,
  ): Promise<DashboardResponse> {
    // Validate inputs
    if (!year || year < 2000 || year > 2100) {
      throw new BadRequestException('Năm không hợp lệ');
    }

    if (!branchId) {
      throw new BadRequestException('branchId là bắt buộc');
    }

    // Date range cho year
    const startDate = new Date(year, 0, 1); // Jan 1
    const endDate = new Date(year, 11, 31, 23, 59, 59); // Dec 31

    // 1. Aggregate Revenue by Month
    const revenueByMonthData = await this.aggregateRevenueByMonth(
      branchId,
      startDate,
      endDate,
    );

    // 2. Aggregate Expense by Month
    const expenseByMonthData = await this.aggregateExpenseByMonth(
      branchId,
      startDate,
      endDate,
    );

    // 3. Revenue by Subject (optional, không crash nếu lỗi)
    let revenueBySubject: Array<{ subject: string; amount: number }> = [];
    try {
      revenueBySubject = await this.aggregateRevenueBySubject(
        branchId,
        startDate,
        endDate,
      );
    } catch (error) {
      console.warn('Could not aggregate revenue by subject:', error.message);
      revenueBySubject = [];
    }

    // 4. Normalize to 12 months & calculate totals
    const detailByMonth = this.mergeMonthlyData(
      revenueByMonthData,
      expenseByMonthData,
    );

    const totalRevenue = detailByMonth.reduce((sum, m) => sum + m.revenue, 0);
    const totalExpense = detailByMonth.reduce((sum, m) => sum + m.expense, 0);
    const profit = totalRevenue - totalExpense;

    return {
      branchId,
      year,
      summary: {
        totalRevenue,
        totalExpense,
        profit,
      },
      chart: {
        revenueByMonth: detailByMonth.map((m) => ({
          month: m.month,
          amount: m.revenue,
        })),
        expenseByMonth: detailByMonth.map((m) => ({
          month: m.month,
          amount: m.expense,
        })),
      },
      revenueBySubject,
      detailByMonth,
    };
  }

  private async aggregateRevenueByMonth(
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ month: number; amount: number }>> {
    const matchStage: any = {
      status: PaymentStatus.SUCCESS,
      $or: [
        { paidAt: { $gte: startDate, $lte: endDate } },
        { paidAt: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };

    // Build aggregation pipeline
    const pipeline: any[] = [{ $match: matchStage }];

    // Filter by branch if not ALL
    if (branchId !== 'ALL') {
      pipeline.push(
        // Lookup student để lấy branchId nếu payment không có
        {
          $lookup: {
            from: 'users',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student',
          },
        },
        { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
        // Match branchId: ưu tiên payment.branchId, fallback student.branchId
        {
          $match: {
            $expr: {
              $eq: [
                {
                  $cond: [
                    { $ifNull: ['$branchId', false] },
                    '$branchId',
                    '$student.branchId',
                  ],
                },
                new Types.ObjectId(branchId),
              ],
            },
          },
        },
      );
    }

    // Add fields để tính effectiveDate
    pipeline.push({
      $addFields: {
        effectiveDate: { $ifNull: ['$paidAt', '$createdAt'] },
      },
    });

    // Group by month
    pipeline.push(
      {
        $group: {
          _id: { $month: '$effectiveDate' },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    );

    const result = await this.paymentModel.aggregate(pipeline);

    return result.map((r) => ({
      month: r._id,
      amount: r.amount,
    }));
  }

  private async aggregateExpenseByMonth(
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ month: number; amount: number }>> {
    const matchStage: any = {
      expenseDate: { $gte: startDate, $lte: endDate },
    };

    // Filter by branch if not ALL
    if (branchId !== 'ALL') {
      matchStage.branchId = new Types.ObjectId(branchId);
    }

    const result = await this.expenseModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $month: '$expenseDate' },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((r) => ({
      month: r._id,
      amount: r.amount,
    }));
  }

  private async aggregateRevenueBySubject(
    branchId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ subject: string; amount: number }>> {
    const matchStage: any = {
      status: PaymentStatus.SUCCESS,
      $or: [
        { paidAt: { $gte: startDate, $lte: endDate } },
        { paidAt: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };

    // Build pipeline
    const pipeline: any[] = [{ $match: matchStage }];

    // Add branch filter with fallback if not ALL
    if (branchId !== 'ALL') {
      pipeline.push(
        // Lookup student for fallback
        {
          $lookup: {
            from: 'users',
            localField: 'studentId',
            foreignField: '_id',
            as: 'studentInfo',
          },
        },
        { $unwind: { path: '$studentInfo', preserveNullAndEmptyArrays: true } },
        // Match branch
        {
          $match: {
            $expr: {
              $eq: [
                {
                  $cond: [
                    { $ifNull: ['$branchId', false] },
                    '$branchId',
                    '$studentInfo.branchId',
                  ],
                },
                new Types.ObjectId(branchId),
              ],
            },
          },
        },
      );
    }

    // Continue with request and class lookups
    // Use snapshot subjectName for aggregation (Reliable after backfill)
    pipeline.push(
      {
        $group: {
          _id: '$subjectName',
          amount: { $sum: '$amount' },
        },
      },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { amount: -1 } },
    );

    const result = await this.paymentModel.aggregate(pipeline);

    return result.map((r) => ({
      subject: r._id || 'Không xác định',
      amount: Math.round(r.amount),
    }));
  }

  private mergeMonthlyData(
    revenue: Array<{ month: number; amount: number }>,
    expense: Array<{ month: number; amount: number }>,
  ): MonthlyData[] {
    const merged: MonthlyData[] = [];

    // Create map for quick lookup
    const revenueMap = new Map(revenue.map((r) => [r.month, r.amount]));
    const expenseMap = new Map(expense.map((e) => [e.month, e.amount]));

    // Fill all 12 months
    for (let month = 1; month <= 12; month++) {
      const rev = revenueMap.get(month) || 0;
      const exp = expenseMap.get(month) || 0;

      merged.push({
        month,
        revenue: rev,
        expense: exp,
        profit: rev - exp,
      });
    }

    return merged;
  }

  async getClassFinancialHealth(
    branchId: string,
    risk?: 'all' | 'green' | 'yellow' | 'red',
  ): Promise<ClassFinancialHealthItem[]> {
    const query: any = {
      status: {
        $in: [
          ClassPaymentRequestStatus.ACTIVE,
          ClassPaymentRequestStatus.PENDING_EXCEPTION,
        ],
      },
      financialSnapshot: { $ne: null },
    };

    if (risk && risk !== 'all') {
      query['financialSnapshot.riskLevel'] = risk;
    }

    if (branchId !== 'ALL') {
      const classes = await this.classModel
        .find({ branchId: new Types.ObjectId(branchId) })
        .select('_id')
        .lean();
      query.classId = { $in: classes.map((c) => c._id) };
    }

    const items = await this.classRequestModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    const riskOrder: Record<'green' | 'yellow' | 'red', number> = {
      green: 1,
      yellow: 2,
      red: 3,
    };

    const itemsWithPayout = await Promise.all(
      items.map(async (item) => {
        const paidRate =
          item.totalStudents > 0 ? item.paidCount / item.totalStudents : 0;

        const payout = await this.payoutModel
          .findOne({
            classId: item.classId,
            blockNumber: Math.ceil(item.paidCount / 10),
          })
          .lean();

        return {
          classRequestId: item._id.toString(),
          classId: item.classId.toString(),
          className: item.className,
          classSubject: item.classSubject,
          status: item.status,
          dueDate: item.dueDate,
          totalStudents: item.totalStudents,
          paidCount: item.paidCount,
          paidRate,
          payoutStatus: payout?.status || 'unpaid',
          snapshot: {
            listedRevenue: item.financialSnapshot?.listedRevenue || 0,
            scholarshipDiscountTotal:
              item.financialSnapshot?.scholarshipDiscountTotal || 0,
            scholarshipDiscountRatio:
              item.financialSnapshot?.scholarshipDiscountRatio || 0,
            estimatedRevenue: item.financialSnapshot?.estimatedRevenue || 0,
            estimatedCost: item.financialSnapshot?.estimatedCost || 0,
            projectedProfit: item.financialSnapshot?.projectedProfit || 0,
            collectedRevenue: item.financialSnapshot?.collectedRevenue || 0,
            outstandingAmount: item.financialSnapshot?.outstandingAmount || 0,
            overdueDebtAmount: item.financialSnapshot?.overdueDebtAmount || 0,
            actualCollectionRate:
              item.financialSnapshot?.actualCollectionRate || 0,
            actualProfit: item.financialSnapshot?.actualProfit || 0,
            minProfitTarget: item.financialSnapshot?.minProfitTarget || 0,
            riskLevel: item.financialSnapshot?.riskLevel || 'green',
            isCapExceeded: Boolean(item.financialSnapshot?.isCapExceeded),
          },
        };
      }),
    );

    return itemsWithPayout.sort((a, b) => {
      const riskDiff =
        riskOrder[b.snapshot.riskLevel] - riskOrder[a.snapshot.riskLevel];
      if (riskDiff !== 0) return riskDiff;
      return b.snapshot.overdueDebtAmount - a.snapshot.overdueDebtAmount;
    });
  }

  async notifyTeacherPayout(
    adminId: string,
    teacherId: string,
    classId: string,
    blockNumber: number,
    amount: number,
  ) {
    // 1. Create or update payout record
    const payout = await this.payoutModel.findOneAndUpdate(
      { teacherId: new Types.ObjectId(teacherId), classId: new Types.ObjectId(classId), blockNumber },
      {
        amount,
        status: PayoutStatus.NOTIFIED,
        paymentDate: new Date(),
      },
      { upsert: true, new: true },
    );
    // 2. Send notification to teacher
    await this.notificationsService.create({
      userId: teacherId,
      title: '💰 Thông báo nhận lương (Tiền mặt)',
      body: `Chào thầy/cô, lương đợt ${blockNumber} của lớp đã có (Số tiền: ${amount.toLocaleString('vi-VN')} VNĐ). Thầy/cô vui lòng gặp Admin nhận tiền mặt và ấn "Xác nhận" trên app sau khi đã nhận đủ.`,
      type: 'info',
    });

    return payout;
  }

  async confirmTeacherPayout(payoutId: string, teacherId: string) {
    const payout = await this.payoutModel.findOne({
      _id: new Types.ObjectId(payoutId),
      teacherId: new Types.ObjectId(teacherId),
    });

    if (!payout) {
      throw new BadRequestException('Không tìm thấy yêu cầu thanh toán');
    }

    if (payout.status === PayoutStatus.CONFIRMED) {
      throw new BadRequestException('Bạn đã xác nhận thanh toán này rồi');
    }

    payout.status = PayoutStatus.CONFIRMED;
    payout.confirmationDate = new Date();
    await payout.save();

    return payout;
  }

  async getTeacherPayouts(teacherId: string) {
    return this.payoutModel
      .find({ teacherId: new Types.ObjectId(teacherId) })
      .populate('classId', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getWeeklyClassFinancialReport(branchId: string): Promise<{
    generatedAt: string;
    branchId: string;
    summary: {
      totalClasses: number;
      red: number;
      yellow: number;
      green: number;
      totalOutstanding: number;
      totalOverdueDebt: number;
    };
    topRisks: Array<{
      classRequestId: string;
      className: string;
      riskLevel: 'green' | 'yellow' | 'red';
      outstandingAmount: number;
      overdueDebtAmount: number;
      actualProfit: number;
      minProfitTarget: number;
      isCapExceeded: boolean;
    }>;
  }> {
    const health = await this.getClassFinancialHealth(branchId, 'all');

    const red = health.filter((h) => h.snapshot.riskLevel === 'red').length;
    const yellow = health.filter(
      (h) => h.snapshot.riskLevel === 'yellow',
    ).length;
    const green = health.filter((h) => h.snapshot.riskLevel === 'green').length;

    const totalOutstanding = health.reduce(
      (sum, h) => sum + h.snapshot.outstandingAmount,
      0,
    );
    const totalOverdueDebt = health.reduce(
      (sum, h) => sum + h.snapshot.overdueDebtAmount,
      0,
    );

    const riskOrder: Record<'green' | 'yellow' | 'red', number> = {
      green: 1,
      yellow: 2,
      red: 3,
    };

    const topRisks = [...health]
      .sort((a, b) => {
        const riskDiff =
          riskOrder[b.snapshot.riskLevel] - riskOrder[a.snapshot.riskLevel];
        if (riskDiff !== 0) return riskDiff;
        return b.snapshot.overdueDebtAmount - a.snapshot.overdueDebtAmount;
      })
      .slice(0, 10)
      .map((h) => ({
        classRequestId: h.classRequestId,
        className: h.className,
        riskLevel: h.snapshot.riskLevel,
        outstandingAmount: h.snapshot.outstandingAmount,
        overdueDebtAmount: h.snapshot.overdueDebtAmount,
        actualProfit: h.snapshot.actualProfit,
        minProfitTarget: h.snapshot.minProfitTarget,
        isCapExceeded: h.snapshot.isCapExceeded,
      }));

    return {
      generatedAt: new Date().toISOString(),
      branchId,
      summary: {
        totalClasses: health.length,
        red,
        yellow,
        green,
        totalOutstanding,
        totalOverdueDebt,
      },
      topRisks,
    };
  }
}
