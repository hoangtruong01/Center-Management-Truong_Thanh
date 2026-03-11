import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClassDocument = HydratedDocument<ClassEntity>;

@Schema({ timestamps: true })
export class ClassEntity {
  @Prop({ required: true })
  name: string;

  @Prop()
  subject?: string;

  @Prop()
  grade?: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  teacherId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch' })
  branchId?: Types.ObjectId;

  @Prop({ default: 30 })
  maxStudents?: number;

  @Prop({
    type: [
      {
        dayOfWeek: Number,
        startTime: String,
        endTime: String,
        room: String,
      },
    ],
  })
  schedule?: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
  }[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  studentIds: Types.ObjectId[];

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ default: 'active' })
  status: 'active' | 'inactive' | 'completed';

  // ===== Payment Fields =====
  @Prop({ default: 0 })
  fee: number;

  @Prop({ default: 'VND' })
  currency: string;

  @Prop()
  feeNote?: string;
}

export const ClassSchema = SchemaFactory.createForClass(ClassEntity);
