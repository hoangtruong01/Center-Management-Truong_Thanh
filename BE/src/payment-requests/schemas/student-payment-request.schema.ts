import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StudentPaymentRequestDocument =
  HydratedDocument<StudentPaymentRequest>;

export enum StudentPaymentRequestStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class StudentPaymentRequest {
  @Prop({
    type: Types.ObjectId,
    ref: 'ClassPaymentRequest',
    required: true,
    index: true,
  })
  classPaymentRequestId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ClassEntity', required: true })
  classId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  // Snapshot student info
  @Prop({ required: true })
  studentName: string;

  @Prop()
  studentCode?: string;

  // Snapshot class info
  @Prop({ required: true })
  className: string;

  @Prop()
  classSubject?: string;

  // Snapshot request info
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  dueDate?: Date;

  // Pricing with scholarship
  @Prop({ required: true })
  baseAmount: number;

  @Prop({ default: 0 })
  scholarshipPercent: number;

  @Prop()
  scholarshipType?: string;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ required: true })
  finalAmount: number;

  @Prop({ default: 'VND' })
  currency: string;

  // Status
  @Prop({
    type: String,
    enum: StudentPaymentRequestStatus,
    default: StudentPaymentRequestStatus.PENDING,
  })
  status: StudentPaymentRequestStatus;

  @Prop()
  paidAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  paymentId?: Types.ObjectId;
}

export const StudentPaymentRequestSchema = SchemaFactory.createForClass(
  StudentPaymentRequest,
);
StudentPaymentRequestSchema.index({ studentId: 1, status: 1 });
