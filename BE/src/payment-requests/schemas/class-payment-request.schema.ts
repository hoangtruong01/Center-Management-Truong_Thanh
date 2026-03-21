import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClassPaymentRequestDocument = HydratedDocument<ClassPaymentRequest>;

export enum ClassPaymentRequestStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PENDING_EXCEPTION = 'pending_exception',
}

export type FinancialRiskLevel = 'green' | 'yellow' | 'red';

@Schema({ timestamps: true })
export class ClassPaymentRequest {
  @Prop({
    type: Types.ObjectId,
    ref: 'ClassEntity',
    required: true,
    index: true,
  })
  classId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'VND' })
  currency: string;

  @Prop()
  dueDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({
    type: String,
    enum: ClassPaymentRequestStatus,
    default: ClassPaymentRequestStatus.ACTIVE,
  })
  status: ClassPaymentRequestStatus;

  // Snapshot class info
  @Prop({ required: true })
  className: string;

  @Prop()
  classSubject?: string;

  // Stats (updated when payments are made)
  @Prop({ default: 0 })
  totalStudents: number;

  @Prop({ default: 0 })
  paidCount: number;

  @Prop({ default: 0 })
  totalCollected: number;

  @Prop({
    type: {
      listedRevenue: Number,
      scholarshipDiscountTotal: Number,
      scholarshipDiscountRatio: Number,
      expectedCollectionRate: Number,
      estimatedRevenue: Number,
      estimatedCost: Number,
      minProfitTarget: Number,
      projectedProfit: Number,
      discountCapAmount: Number,
      discountCapPercent: Number,
      collectedRevenue: Number,
      outstandingAmount: Number,
      overdueDebtAmount: Number,
      actualCollectionRate: Number,
      actualProfit: Number,
      riskLevel: String,
      isCapExceeded: Boolean,
      capExceedPolicy: String,
      capExceedReason: String,
      exceptionApprovedBy: { type: Types.ObjectId, ref: 'User' },
      exceptionApprovedAt: Date,
      exceptionRejectedBy: { type: Types.ObjectId, ref: 'User' },
      exceptionRejectedAt: Date,
      exceptionRejectedReason: String,
      snapshotAt: Date,
    },
    default: null,
  })
  financialSnapshot?: {
    listedRevenue: number;
    scholarshipDiscountTotal: number;
    scholarshipDiscountRatio: number;
    expectedCollectionRate: number;
    estimatedRevenue: number;
    estimatedCost: number;
    minProfitTarget: number;
    projectedProfit: number;
    discountCapAmount: number;
    discountCapPercent: number;
    collectedRevenue: number;
    outstandingAmount: number;
    overdueDebtAmount: number;
    actualCollectionRate: number;
    actualProfit: number;
    riskLevel: FinancialRiskLevel;
    isCapExceeded: boolean;
    capExceedPolicy: 'block' | 'request_exception';
    capExceedReason?: string;
    exceptionApprovedBy?: Types.ObjectId;
    exceptionApprovedAt?: Date;
    exceptionRejectedBy?: Types.ObjectId;
    exceptionRejectedAt?: Date;
    exceptionRejectedReason?: string;
    snapshotAt: Date;
  };
}

export const ClassPaymentRequestSchema =
  SchemaFactory.createForClass(ClassPaymentRequest);
ClassPaymentRequestSchema.index({ classId: 1, createdAt: -1 });
