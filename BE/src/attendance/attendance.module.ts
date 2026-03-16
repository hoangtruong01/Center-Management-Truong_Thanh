import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Session.name, schema: SessionSchema },
      { name: ClassEntity.name, schema: ClassSchema },
    ]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
