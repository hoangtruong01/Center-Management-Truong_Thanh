import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SessionStatus, SessionType } from '../dto/create-session.dto';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'ClassEntity', required: false })
  classId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  teacherId?: Types.ObjectId;

  @Prop()
  subject?: string;

  @Prop()
  title?: string;

  @Prop()
  room?: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ type: String, enum: SessionType, default: SessionType.Regular })
  type: SessionType;

  @Prop({ type: String, enum: SessionStatus, default: SessionStatus.Pending })
  status: SessionStatus;

  @Prop({ type: Types.ObjectId, ref: 'Session' })
  originalSessionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledBy?: Types.ObjectId;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancelReason?: string;

  @Prop({ default: false })
  conflictResolutionRequired?: boolean;

  @Prop({
    type: String,
    enum: ['pending', 'resolved'],
    default: 'resolved',
  })
  conflictResolutionStatus?: 'pending' | 'resolved';

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  note?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
