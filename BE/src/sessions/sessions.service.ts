import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import { CreateSessionDto, SessionType } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import {
  CancelAndMakeupSessionDto,
  MakeupConflictPolicy,
} from './dto/cancel-and-makeup-session.dto';
import {
  ScheduleQueryDto,
  GenerateSessionsDto,
  CheckConflictDto,
  BulkCreateSessionsDto,
} from './dto/schedule-query.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ClassEntity, ClassDocument } from '../classes/schemas/class.schema';

type StudentConflictDetail = {
  studentId: string;
  studentName: string;
  conflictingClassId: string;
  conflictingClassName: string;
  conflictingSessionId: string;
  conflictingStartTime: Date;
  conflictingEndTime: Date;
};

type MakeupConflictReport = {
  classId: string;
  totalStudents: number;
  conflictStudents: StudentConflictDetail[];
  conflictingStudentCount: number;
  conflictingStudentIds: string[];
  conflictRate: number;
  teacherConflicts: Array<{
    sessionId: string;
    startTime: Date;
    endTime: Date;
  }>;
  roomConflicts: Array<{
    sessionId: string;
    room: string;
    startTime: Date;
    endTime: Date;
  }>;
  policyDecision: {
    policy: MakeupConflictPolicy;
    canCreate: boolean;
    requiresManualResolution: boolean;
    thresholdUsed?: number;
    reason?: string;
  };
};

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private model: Model<SessionDocument>,
    @InjectModel(ClassEntity.name) private classModel: Model<ClassDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private appendCancelReason(note: string | undefined, reason: string): string {
    const cancelNote = `Cancelled reason: ${reason}`;
    if (!note) return cancelNote;
    return `${note}\n${cancelNote}`;
  }

  private buildOverlapFilter(
    startTime: Date,
    endTime: Date,
    excludeSessionId: string,
  ) {
    return {
      _id: { $ne: new Types.ObjectId(excludeSessionId) },
      status: { $ne: 'cancelled' },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };
  }

  private evaluatePolicy(
    report: Omit<MakeupConflictReport, 'policyDecision'>,
    policy: MakeupConflictPolicy,
    maxConflictRate: number,
  ): MakeupConflictReport['policyDecision'] {
    if (report.teacherConflicts.length > 0) {
      return {
        policy,
        canCreate: false,
        requiresManualResolution: false,
        reason: 'Teacher has schedule conflict at selected make-up time',
      };
    }

    if (report.roomConflicts.length > 0) {
      return {
        policy,
        canCreate: false,
        requiresManualResolution: false,
        reason: 'Room is occupied at selected make-up time',
      };
    }

    if (policy === MakeupConflictPolicy.BlockAll) {
      return {
        policy,
        canCreate: report.conflictingStudentCount === 0,
        requiresManualResolution: false,
        reason:
          report.conflictingStudentCount > 0
            ? 'Student conflicts detected in strict mode'
            : undefined,
      };
    }

    if (policy === MakeupConflictPolicy.AllowWithThreshold) {
      return {
        policy,
        canCreate: report.conflictRate <= maxConflictRate,
        requiresManualResolution: false,
        thresholdUsed: maxConflictRate,
        reason:
          report.conflictRate > maxConflictRate
            ? `Conflict rate ${Math.round(report.conflictRate * 100)}% exceeds threshold ${Math.round(maxConflictRate * 100)}%`
            : undefined,
      };
    }

    return {
      policy,
      canCreate: true,
      requiresManualResolution: report.conflictingStudentCount > 0,
      reason:
        report.conflictingStudentCount > 0
          ? 'Students with conflicts require manual follow-up'
          : undefined,
    };
  }

  private async analyzeMakeupConflicts(
    originalSession: SessionDocument,
    classDoc: ClassDocument,
    makeupStartTime: Date,
    makeupEndTime: Date,
    policy: MakeupConflictPolicy,
    maxConflictRate: number,
  ): Promise<MakeupConflictReport> {
    const overlapFilter = this.buildOverlapFilter(
      makeupStartTime,
      makeupEndTime,
      originalSession._id.toString(),
    );
    const classId = classDoc._id.toString();

    const teacherId = originalSession.teacherId || classDoc.teacherId;
    let teacherConflicts: MakeupConflictReport['teacherConflicts'] = [];
    if (teacherId) {
      const teacherClassIds = await this.classModel
        .find({ teacherId })
        .select('_id')
        .lean()
        .exec();

      const teacherOwnedClassIds = teacherClassIds.map((item: any) => item._id);

      const teacherConflictDocs = await this.model
        .find({
          ...overlapFilter,
          $or: [{ teacherId }, { classId: { $in: teacherOwnedClassIds } }],
        })
        .select('_id startTime endTime')
        .lean()
        .exec();

      teacherConflicts = teacherConflictDocs.map((doc: any) => ({
        sessionId: doc._id.toString(),
        startTime: doc.startTime,
        endTime: doc.endTime,
      }));
    }

    let roomConflicts: MakeupConflictReport['roomConflicts'] = [];
    if (originalSession.room) {
      const roomConflictDocs = await this.model
        .find({
          ...overlapFilter,
          room: originalSession.room,
        })
        .select('_id room startTime endTime')
        .lean()
        .exec();

      roomConflicts = roomConflictDocs.map((doc: any) => ({
        sessionId: doc._id.toString(),
        room: doc.room,
        startTime: doc.startTime,
        endTime: doc.endTime,
      }));
    }

    const classStudentIds = (classDoc.studentIds || []).map((id) =>
      id.toString(),
    );
    const totalStudents = classStudentIds.length;
    const classStudentIdSet = new Set(classStudentIds);

    let conflictStudents: StudentConflictDetail[] = [];
    if (totalStudents > 0) {
      const otherClasses = await this.classModel
        .find({
          _id: { $ne: classDoc._id },
          studentIds: { $in: classDoc.studentIds },
        })
        .select('_id name studentIds')
        .lean()
        .exec();

      if (otherClasses.length > 0) {
        const otherClassIds = otherClasses.map((item: any) => item._id);
        const otherClassMap = new Map(
          otherClasses.map((item: any) => [item._id.toString(), item]),
        );

        const conflictSessionDocs = await this.model
          .find({
            ...overlapFilter,
            classId: { $in: otherClassIds },
          })
          .select('_id classId startTime endTime')
          .lean()
          .exec();

        if (conflictSessionDocs.length > 0) {
          const studentDocs = await this.userModel
            .find({ _id: { $in: classDoc.studentIds } })
            .select('_id name')
            .lean()
            .exec();
          const studentNameMap = new Map(
            studentDocs.map((student: any) => [
              student._id.toString(),
              student.name,
            ]),
          );

          for (const conflictSession of conflictSessionDocs as any[]) {
            const relatedClass = otherClassMap.get(
              conflictSession.classId.toString(),
            );
            if (!relatedClass?.studentIds?.length) continue;

            for (const sid of relatedClass.studentIds as Types.ObjectId[]) {
              const sidStr = sid.toString();
              if (!classStudentIdSet.has(sidStr)) continue;

              conflictStudents.push({
                studentId: sidStr,
                studentName: studentNameMap.get(sidStr) || 'Unknown',
                conflictingClassId: relatedClass._id.toString(),
                conflictingClassName: relatedClass.name,
                conflictingSessionId: conflictSession._id.toString(),
                conflictingStartTime: conflictSession.startTime,
                conflictingEndTime: conflictSession.endTime,
              });
            }
          }
        }
      }
    }

    const uniqueConflictStudents = Array.from(
      new Map(
        conflictStudents.map((item) => [
          `${item.studentId}-${item.conflictingSessionId}`,
          item,
        ]),
      ).values(),
    );
    const conflictingStudentIds = [
      ...new Set(uniqueConflictStudents.map((item) => item.studentId)),
    ];
    const conflictingStudentCount = conflictingStudentIds.length;
    const conflictRate =
      totalStudents > 0 ? conflictingStudentCount / totalStudents : 0;

    const baseReport = {
      classId,
      totalStudents,
      conflictStudents: uniqueConflictStudents,
      conflictingStudentCount,
      conflictingStudentIds,
      conflictRate,
      teacherConflicts,
      roomConflicts,
    };

    return {
      ...baseReport,
      policyDecision: this.evaluatePolicy(baseReport, policy, maxConflictRate),
    };
  }

  async cancelAndCreateMakeupSession(
    user: UserDocument,
    sessionId: string,
    dto: CancelAndMakeupSessionDto,
  ) {
    const originalSession = await this.model.findById(sessionId).exec();
    if (!originalSession) {
      throw new NotFoundException('Session not found');
    }

    if (!originalSession.classId) {
      throw new BadRequestException(
        'Only class-based sessions support make-up flow',
      );
    }

    if (originalSession.status === 'cancelled') {
      throw new BadRequestException('Session is already cancelled');
    }

    const classDoc = await this.classModel
      .findById(originalSession.classId)
      .exec();
    if (!classDoc) {
      throw new NotFoundException('Class not found');
    }

    const makeupStartTime = new Date(dto.makeupStartTime);
    const makeupEndTime = new Date(dto.makeupEndTime);
    if (makeupEndTime <= makeupStartTime) {
      throw new BadRequestException(
        'makeupEndTime must be after makeupStartTime',
      );
    }

    const policy = dto.policy || MakeupConflictPolicy.BlockAll;
    const maxConflictRate = dto.maxConflictRate ?? 0.15;
    const report = await this.analyzeMakeupConflicts(
      originalSession,
      classDoc,
      makeupStartTime,
      makeupEndTime,
      policy,
      maxConflictRate,
    );

    if (dto.dryRun) {
      return {
        previewOnly: true,
        originalSessionId: originalSession._id.toString(),
        proposedMakeup: {
          startTime: makeupStartTime,
          endTime: makeupEndTime,
        },
        report,
      };
    }

    if (!report.policyDecision.canCreate) {
      throw new BadRequestException({
        message:
          report.policyDecision.reason || 'Cannot create make-up session',
        report,
      });
    }

    await this.model
      .findByIdAndUpdate(originalSession._id, {
        status: 'cancelled',
        cancelledBy: user._id,
        cancelledAt: new Date(),
        cancelReason: dto.reason,
        note: this.appendCancelReason(originalSession.note, dto.reason),
      })
      .exec();

    const createdMakeupSession = await new this.model({
      classId: originalSession.classId,
      teacherId: originalSession.teacherId || classDoc.teacherId,
      subject: originalSession.subject,
      title: originalSession.title,
      room: originalSession.room,
      startTime: makeupStartTime,
      endTime: makeupEndTime,
      type: SessionType.Makeup,
      status: 'pending',
      note: `Make-up for session ${originalSession._id.toString()}`,
      createdBy: user._id,
      originalSessionId: originalSession._id,
      conflictResolutionRequired:
        report.policyDecision.requiresManualResolution,
      conflictResolutionStatus: report.policyDecision.requiresManualResolution
        ? 'pending'
        : 'resolved',
    }).save();

    return {
      previewOnly: false,
      message: 'Session cancelled and make-up session created',
      originalSessionId: originalSession._id.toString(),
      makeupSessionId: createdMakeupSession._id.toString(),
      report,
      makeupSession: createdMakeupSession,
    };
  }

  async create(user: UserDocument, dto: CreateSessionDto) {
    const doc = new this.model({
      ...dto,
      classId: dto.classId ? new Types.ObjectId(dto.classId) : undefined,
      teacherId: dto.teacherId ? new Types.ObjectId(dto.teacherId) : undefined,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      createdBy: user._id,
    });
    return doc.save();
  }

  findByClass(classId: string) {
    return this.model.find({ classId }).exec();
  }

  findAll() {
    return this.model.find().exec();
  }

  // Lấy lịch theo khoảng thời gian với filter
  async getSchedule(query: ScheduleQueryDto) {
    const { startDate, endDate, teacherId, classId, branchId, status } = query;

    const filter: any = {
      startTime: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    if (classId) {
      filter.classId = new Types.ObjectId(classId);
    }

    if (status) {
      filter.status = status;
    }

    // Nếu có filter theo teacherId hoặc branchId, cần tìm các classId phù hợp trước
    if (teacherId || branchId) {
      const classFilter: any = {};
      if (teacherId) classFilter.teacherId = new Types.ObjectId(teacherId);
      if (branchId) classFilter.branchId = branchId;

      const classes = await this.classModel
        .find(classFilter)
        .select('_id')
        .exec();
      const classIds = classes.map((c) => c._id);

      if (classId) {
        // Nếu đã có classId filter, kiểm tra xem nó có thuộc về teacher/branch không
        if (!classIds.some((id) => id.toString() === classId)) {
          return []; // classId không thuộc teacher/branch này
        }
      } else {
        // Include sessions from teacher's classes OR directly assigned to the teacher
        const orConditions: any[] = [{ classId: { $in: classIds } }];
        if (teacherId) {
          orConditions.push({
            teacherId: new Types.ObjectId(teacherId),
            classId: { $exists: false },
          });
          orConditions.push({
            teacherId: new Types.ObjectId(teacherId),
            classId: null,
          });
        }
        filter.$or = orConditions;
      }
    }

    const sessions = await this.model
      .find(filter)
      .populate({
        path: 'classId',
        select: 'name subject teacherId schedule',
        populate: {
          path: 'teacherId',
          select: 'name email subjects',
        },
      })
      .populate('teacherId', 'name email subjects')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ startTime: 1 })
      .exec();

    return sessions;
  }

  // Kiểm tra xung đột lịch của giáo viên
  async checkConflict(dto: CheckConflictDto) {
    const { teacherId, startTime, endTime, excludeSessionId } = dto;

    // Tìm tất cả lớp của giáo viên này
    const classes = await this.classModel
      .find({ teacherId: new Types.ObjectId(teacherId) })
      .select('_id')
      .exec();
    const classIds = classes.map((c) => c._id);

    if (classIds.length === 0) {
      return { hasConflict: false, conflicts: [] };
    }

    // Tìm sessions trùng thời gian
    const conflictFilter: any = {
      classId: { $in: classIds },
      $or: [
        {
          startTime: { $lt: new Date(endTime) },
          endTime: { $gt: new Date(startTime) },
        },
      ],
      status: { $ne: 'cancelled' },
    };

    if (excludeSessionId) {
      conflictFilter._id = { $ne: new Types.ObjectId(excludeSessionId) };
    }

    const conflicts = await this.model
      .find(conflictFilter)
      .populate('classId', 'name subject')
      .exec();

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  // Tự động tạo sessions từ schedule của class
  async generateSessions(user: UserDocument, dto: GenerateSessionsDto) {
    const { classId, startDate, endDate, type = SessionType.Regular } = dto;

    const classDoc = await this.classModel.findById(classId).exec();
    if (!classDoc) {
      throw new NotFoundException('Class not found');
    }

    if (!classDoc.schedule || classDoc.schedule.length === 0) {
      throw new BadRequestException('Class has no schedule defined');
    }

    const sessions: Session[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Map dayOfWeek string to number (0 = Sunday, 1 = Monday, ...)
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      'chủ nhật': 0,
      'thứ 2': 1,
      'thứ 3': 2,
      'thứ 4': 3,
      'thứ 5': 4,
      'thứ 6': 5,
      'thứ 7': 6,
    };

    // Iterate through each day from start to end
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();

      // Check if this day matches any schedule
      for (const schedule of classDoc.schedule) {
        const scheduleDayNum = schedule.dayOfWeek;

        if (scheduleDayNum === dayOfWeek) {
          // Parse time
          const [startHour, startMin] = schedule.startTime
            .split(':')
            .map(Number);
          const [endHour, endMin] = schedule.endTime.split(':').map(Number);

          const sessionStart = new Date(current);
          sessionStart.setHours(startHour, startMin, 0, 0);

          const sessionEnd = new Date(current);
          sessionEnd.setHours(endHour, endMin, 0, 0);

          // Check if session already exists
          const existing = await this.model
            .findOne({
              classId: new Types.ObjectId(classId),
              startTime: sessionStart,
            })
            .exec();

          if (!existing) {
            const session = new this.model({
              classId: new Types.ObjectId(classId),
              startTime: sessionStart,
              endTime: sessionEnd,
              type,
              status: 'pending',
              createdBy: user._id,
              note: schedule.room ? `Phòng: ${schedule.room}` : undefined,
            });
            const saved = await session.save();
            sessions.push(saved);
          }
        }
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
    }

    return {
      message: `Generated ${sessions.length} sessions`,
      sessions,
    };
  }

  // Tạo nhiều sessions cùng lúc
  async bulkCreate(user: UserDocument, dto: BulkCreateSessionsDto) {
    const { classId, sessions: sessionData } = dto;

    const classDoc = await this.classModel.findById(classId).exec();
    if (!classDoc) {
      throw new NotFoundException('Class not found');
    }

    const created: Session[] = [];
    for (const item of sessionData) {
      const session = new this.model({
        classId: new Types.ObjectId(classId),
        startTime: new Date(item.startTime),
        endTime: new Date(item.endTime),
        type: item.type || SessionType.Regular,
        status: 'pending',
        createdBy: user._id,
        note: item.note,
      });
      const saved = await session.save();
      created.push(saved);
    }

    return created;
  }

  // Lấy lịch của một giáo viên
  async getTeacherSchedule(
    teacherId: string,
    startDate: string,
    endDate: string,
  ) {
    const classes = await this.classModel
      .find({ teacherId: new Types.ObjectId(teacherId) })
      .select('_id name subject')
      .exec();

    const classIds = classes.map((c) => c._id);

    const sessions = await this.model
      .find({
        classId: { $in: classIds },
        startTime: { $gte: new Date(startDate) },
        endTime: { $lte: new Date(endDate) },
        status: { $ne: 'cancelled' },
      })
      .populate('classId', 'name subject')
      .populate('teacherId', 'name email subjects')
      .sort({ startTime: 1 })
      .exec();

    return sessions;
  }

  // Lấy lịch của người dùng hiện tại (student hoặc teacher)
  async getMySessions(user: UserDocument) {
    // Mặc định lấy lịch từ 7 ngày trước đến 30 ngày sau
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const userId = user._id.toString();
    const role = user.role;

    if (role === 'teacher') {
      return this.getTeacherSchedule(
        userId,
        startDate.toISOString(),
        endDate.toISOString(),
      );
    } else if (role === 'student') {
      return this.getStudentSchedule(
        userId,
        startDate.toISOString(),
        endDate.toISOString(),
      );
    }

    // For parents, get sessions of their children
    if (role === 'parent' && user.childrenIds?.length) {
      const allSessions: SessionDocument[] = [];
      for (const childId of user.childrenIds) {
        const childSessions = await this.getStudentSchedule(
          childId.toString(),
          startDate.toISOString(),
          endDate.toISOString(),
        );
        allSessions.push(...childSessions);
      }
      // Loại bỏ sessions trùng lặp dựa trên _id
      const uniqueSessions = allSessions.filter(
        (session, index, self) =>
          index ===
          self.findIndex((s) => s._id.toString() === session._id.toString()),
      );
      return uniqueSessions.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
    }

    return [];
  }

  // Lấy lịch của một học sinh
  async getStudentSchedule(
    studentId: string,
    startDate: string,
    endDate: string,
  ) {
    const classes = await this.classModel
      .find({ studentIds: new Types.ObjectId(studentId) })
      .select('_id name subject teacherId')
      .populate('teacherId', 'name')
      .exec();

    const classIds = classes.map((c) => c._id);

    const sessions = await this.model
      .find({
        classId: { $in: classIds },
        startTime: { $gte: new Date(startDate) },
        endTime: { $lte: new Date(endDate) },
        status: { $ne: 'cancelled' },
      })
      .populate({
        path: 'classId',
        select: 'name subject teacherId',
        populate: {
          path: 'teacherId',
          select: 'name',
        },
      })
      .populate('teacherId', 'name email subjects')
      .sort({ startTime: 1 })
      .exec();

    return sessions;
  }

  // Thống kê sessions
  async getStatistics(startDate: string, endDate: string, branchId?: string) {
    const matchStage: any = {
      startTime: { $gte: new Date(startDate) },
      endTime: { $lte: new Date(endDate) },
    };

    const stats = await this.model.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await this.model.countDocuments(matchStage);

    return {
      total,
      byStatus: stats.reduce(
        (acc, item) => {
          acc[item._id] = item.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  async update(id: string, dto: UpdateSessionDto, approver?: UserDocument) {
    const updatePayload: any = { ...dto };
    if (dto.status && approver) updatePayload.approvedBy = approver._id;
    if (dto.startTime) updatePayload.startTime = new Date(dto.startTime);
    if (dto.endTime) updatePayload.endTime = new Date(dto.endTime);

    const updated = await this.model
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Session not found');
    return updated;
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Session not found');
  }

  async findById(id: string) {
    const session = await this.model
      .findById(id)
      .populate({
        path: 'classId',
        select: 'name subject teacherId studentIds',
        populate: {
          path: 'teacherId',
          select: 'name email subjects',
        },
      })
      .populate('teacherId', 'name email subjects')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .exec();

    if (!session) throw new NotFoundException('Session not found');
    return session;
  }
}
