import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClassEntity, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { UserRole } from '../common/enums/role.enum';
import { UserDocument } from '../users/schemas/user.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * Tự động chuyển trạng thái các khoá học đã kết thúc sang "completed".
   * Chạy mỗi ngày lúc 2:00 sáng.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleExpiredClasses(): Promise<void> {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(23, 59, 59, 999);

    const expiredClasses = await this.classModel
      .find({
        endDate: { $exists: true, $lte: twoDaysAgo },
        status: 'active',
      })
      .exec();

    if (expiredClasses.length === 0) return;

    this.logger.log(
      `Tìm thấy ${expiredClasses.length} khoá học hết hạn quá 2 ngày, đang chuyển sang trạng thái "đã kết thúc"...`,
    );

    for (const cls of expiredClasses) {
      try {
        const classId = (cls as any)._id.toString();
        await this.classModel
          .findByIdAndUpdate(classId, { status: 'completed' })
          .exec();
        this.logger.log(
          `Đã chuyển trạng thái khoá học: ${cls.name} (${classId}) → completed`,
        );
      } catch (error) {
        this.logger.error(
          `Lỗi khi cập nhật khoá học ${cls.name}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Hoàn tất cập nhật ${expiredClasses.length} khoá học hết hạn.`,
    );
  }

  async create(dto: CreateClassDto): Promise<ClassEntity> {
    // Convert string IDs to ObjectId
    const data: any = { ...dto };
    if (dto.teacherId) {
      data.teacherId = new Types.ObjectId(dto.teacherId);
    }
    if (dto.branchId) {
      data.branchId = new Types.ObjectId(dto.branchId);
    }
    if (dto.studentIds && dto.studentIds.length > 0) {
      data.studentIds = dto.studentIds.map((id) => new Types.ObjectId(id));
    }

    const doc = new this.classModel(data);
    await doc.save();
    await doc.populate([
      { path: 'teacherId', select: 'name email' },
      { path: 'branchId', select: 'name' },
      { path: 'studentIds', select: 'name email role branchId' },
    ]);
    return doc;
  }

  async findAllForUser(user: UserDocument): Promise<ClassEntity[]> {
    if (user.role === UserRole.Admin)
      return this.classModel
        .find()
        .populate('teacherId', 'name email')
        .populate('branchId', 'name')
        .populate('studentIds', 'name email role branchId')
        .exec();
    if (user.role === UserRole.Teacher) {
      // Query với cả ObjectId và string để handle dữ liệu cũ
      const userIdString = user._id.toString();
      const userIdObjectId = new Types.ObjectId(user._id);
      return this.classModel
        .find({
          $or: [{ teacherId: userIdObjectId }, { teacherId: userIdString }],
        })
        .populate('teacherId', 'name email')
        .populate('branchId', 'name')
        .populate('studentIds', 'name email role branchId')
        .exec();
    }
    if (user.role === UserRole.Parent) {
      // Parent should use findByStudentId with their child's ID
      // Return empty array - parent must use studentId query param
      return [];
    }
    // Student role
    return this.classModel
      .find({ studentIds: { $in: [new Types.ObjectId(user._id)] } })
      .populate('teacherId', 'name email')
      .populate('branchId', 'name')
      .populate('studentIds', 'name email role branchId')
      .exec();
  }

  async findOne(id: string): Promise<ClassEntity> {
    const doc = await this.classModel
      .findById(id)
      .populate('teacherId', 'name email')
      .populate('branchId', 'name')
      .populate('studentIds', 'name email role branchId')
      .exec();
    if (!doc) throw new NotFoundException('Class not found');
    return doc;
  }

  async update(id: string, dto: UpdateClassDto): Promise<ClassEntity> {
    // Convert string IDs to ObjectId
    const data: any = { ...dto };
    if (dto.teacherId) {
      data.teacherId = new Types.ObjectId(dto.teacherId);
    }
    if (dto.branchId) {
      data.branchId = new Types.ObjectId(dto.branchId);
    }
    if (dto.studentIds && dto.studentIds.length > 0) {
      data.studentIds = dto.studentIds.map((sid) => new Types.ObjectId(sid));
    }

    const updated = await this.classModel
      .findByIdAndUpdate(id, data, { new: true })
      .populate('teacherId', 'name email')
      .populate('branchId', 'name')
      .populate('studentIds', 'name email role branchId')
      .exec();
    if (!updated) throw new NotFoundException('Class not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const res = await this.classModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Class not found');

    // Xóa tất cả sessions liên quan đến lớp này
    await this.sessionModel
      .deleteMany({ classId: new Types.ObjectId(id) })
      .exec();
  }

  // Kiểm tra xung đột lịch học của học sinh
  async checkStudentScheduleConflict(
    studentId: string,
    classId: string,
  ): Promise<{ hasConflict: boolean; conflictingClasses: string[] }> {
    // Lấy lớp đang muốn thêm học sinh vào
    const targetClass = await this.classModel.findById(classId).exec();
    if (
      !targetClass ||
      !targetClass.schedule ||
      targetClass.schedule.length === 0
    ) {
      return { hasConflict: false, conflictingClasses: [] };
    }

    // Lấy tất cả các lớp mà học sinh này đang học
    const studentClasses = await this.classModel
      .find({ studentIds: { $in: [new Types.ObjectId(studentId)] } })
      .exec();

    const conflictingClasses: string[] = [];

    // Kiểm tra xung đột lịch
    for (const existingClass of studentClasses) {
      if (!existingClass.schedule) continue;

      for (const targetSchedule of targetClass.schedule) {
        for (const existingSchedule of existingClass.schedule) {
          // Check if same day
          if (targetSchedule.dayOfWeek === existingSchedule.dayOfWeek) {
            // Parse times
            const targetStart = this.parseTime(targetSchedule.startTime);
            const targetEnd = this.parseTime(targetSchedule.endTime);
            const existingStart = this.parseTime(existingSchedule.startTime);
            const existingEnd = this.parseTime(existingSchedule.endTime);

            // Check overlap
            if (targetStart < existingEnd && targetEnd > existingStart) {
              conflictingClasses.push(existingClass.name);
              break;
            }
          }
        }
      }
    }

    return {
      hasConflict: conflictingClasses.length > 0,
      conflictingClasses: [...new Set(conflictingClasses)], // Remove duplicates
    };
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Thêm học sinh vào lớp
  async addStudentToClass(
    classId: string,
    studentId: string,
  ): Promise<ClassEntity> {
    const classDoc = await this.classModel.findById(classId).exec();
    if (!classDoc) throw new NotFoundException('Class not found');

    const studentObjectId = new Types.ObjectId(studentId);

    // Kiểm tra học sinh đã trong lớp chưa
    const isAlreadyInClass = classDoc.studentIds?.some(
      (id) => id.toString() === studentId,
    );

    if (isAlreadyInClass) {
      throw new BadRequestException('Học sinh đã có trong lớp này');
    }

    // Kiểm tra xung đột lịch học
    const conflictCheck = await this.checkStudentScheduleConflict(
      studentId,
      classId,
    );
    if (conflictCheck.hasConflict) {
      throw new BadRequestException(
        `Học sinh bị trùng lịch với lớp: ${conflictCheck.conflictingClasses.join(', ')}`,
      );
    }

    await this.classModel
      .findByIdAndUpdate(
        classId,
        { $addToSet: { studentIds: studentObjectId } },
        { new: true },
      )
      .exec();

    return this.findOne(classId);
  }

  // Xóa học sinh khỏi lớp
  async removeStudentFromClass(
    classId: string,
    studentId: string,
  ): Promise<ClassEntity> {
    const classDoc = await this.classModel.findById(classId).exec();
    if (!classDoc) throw new NotFoundException('Class not found');

    await this.classModel
      .findByIdAndUpdate(
        classId,
        { $pull: { studentIds: new Types.ObjectId(studentId) } },
        { new: true },
      )
      .exec();

    return this.findOne(classId);
  }

  // Thêm nhiều học sinh vào lớp
  async addStudentsToClass(
    classId: string,
    studentIds: string[],
  ): Promise<ClassEntity> {
    const classDoc = await this.classModel.findById(classId).exec();
    if (!classDoc) throw new NotFoundException('Class not found');

    const studentObjectIds = studentIds.map((id) => new Types.ObjectId(id));

    await this.classModel
      .findByIdAndUpdate(
        classId,
        { $addToSet: { studentIds: { $each: studentObjectIds } } },
        { new: true },
      )
      .exec();

    return this.findOne(classId);
  }

  // Lấy danh sách lớp của một học sinh (dùng cho parent xem con)
  async findByStudentId(studentId: string): Promise<ClassEntity[]> {
    return this.classModel
      .find({ studentIds: { $in: [new Types.ObjectId(studentId)] } })
      .populate('teacherId', 'name email')
      .populate('branchId', 'name')
      .populate('studentIds', 'name email role branchId')
      .exec();
  }
}
