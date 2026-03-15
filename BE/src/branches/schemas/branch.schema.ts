import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BranchDocument = HydratedDocument<Branch>;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: false, trim: true })
  address?: string;

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ required: false, trim: true })
  description?: string;

  @Prop({ default: 'active', enum: ['active', 'inactive'], type: String })
  status: 'active' | 'inactive';

  @Prop({ default: true, type: Boolean })
  isActive: boolean;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
