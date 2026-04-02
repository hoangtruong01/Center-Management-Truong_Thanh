import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeacherPayoutDocument = TeacherPayout & Document;

export enum PayoutStatus {
  NOTIFIED = 'notified',   // Admin notified teacher (paid cash)
  CONFIRMED = 'confirmed', // Teacher confirmed receipt
}

@Schema({ timestamps: true })
export class TeacherPayout {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  teacherId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ClassEntity', required: true })
  classId: Types.ObjectId;

  @Prop({ required: true })
  blockNumber: number;

  @Prop({ required: true })
  amount: number;

  @Prop({
    type: String,
    enum: PayoutStatus,
    default: PayoutStatus.NOTIFIED,
  })
  status: PayoutStatus;

  @Prop()
  paymentDate: Date;

  @Prop()
  confirmationDate: Date;

  @Prop()
  note: string;
}

export const TeacherPayoutSchema = SchemaFactory.createForClass(TeacherPayout);

// Ensure unique payout per teacher/class/block
TeacherPayoutSchema.index({ teacherId: 1, classId: 1, blockNumber: 1 }, { unique: true });
