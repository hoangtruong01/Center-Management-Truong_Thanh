import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AttendanceStatus } from '../dto/create-attendance.dto';

export type AttendanceDocument = HydratedDocument<Attendance>;

@Schema({ timestamps: true })
export class Attendance {
  createdAt?: Date;
  updatedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Session', required: true })
  sessionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  studentId: Types.ObjectId;

  @Prop({ type: String, enum: AttendanceStatus, required: true })
  status: AttendanceStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  markedBy?: Types.ObjectId;

  @Prop()
  note?: string;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
