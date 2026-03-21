import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ApprovalRequestDocument = HydratedDocument<ApprovalRequest>;

export enum ApprovalType {
  Register = 'register',
  LinkParent = 'link_parent',
  PasswordReset = 'password_reset',
  Contact = 'contact',
  ClassTransfer = 'class_transfer',
}

export enum ApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

@Schema({ timestamps: true })
export class ApprovalRequest {
  @Prop({ required: true, enum: ApprovalType, type: String })
  type: ApprovalType;

  @Prop()
  userId?: string;

  @Prop({
    required: true,
    enum: ApprovalStatus,
    type: String,
    default: ApprovalStatus.Pending,
  })
  status: ApprovalStatus;

  @Prop()
  approvedBy?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;
}

export const ApprovalRequestSchema =
  SchemaFactory.createForClass(ApprovalRequest);
