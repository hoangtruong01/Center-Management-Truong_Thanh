import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { AttendanceStatus, CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { TimetableAttendanceDto } from './dto/timetable-attendance.dto';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { ClassEntity, ClassDocument } from '../classes/schemas/class.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly model: Model<AttendanceDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async mark(user: UserDocument, dto: CreateAttendanceDto) {
    return this.model
      .findOneAndUpdate(
        {
          sessionId: new Types.ObjectId(dto.sessionId),
          studentId: new Types.ObjectId(dto.studentId),
        },
        {
          $set: {
            status: dto.status,
            note: dto.note,
            markedBy: user._id,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  async listBySession(sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).exec();
    if (session) {
      await this.ensureAutoAbsentForSessions([session]);
    }

    return this.model
      .find({ sessionId })
      .populate('studentId', 'name email')
      .exec();
  }

  async listByStudent(studentId: string) {
    await this.ensureAutoAbsentForStudent(studentId);

    return this.model
      .find({ studentId: new Types.ObjectId(studentId) })
      .populate({
        path: 'sessionId',
        select: 'startTime endTime classId status',
        populate: {
          path: 'classId',
          select: 'name _id',
        },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    const updated = await this.model
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Attendance not found');
    return updated;
  }

  // Get attendance by class and date
  async getByClassAndDate(classId: string, dateStr: string) {
    const date = new Date(dateStr);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Find sessions for this class on this date
    const sessions = await this.sessionModel
      .find({
        classId: new Types.ObjectId(classId),
        startTime: { $gte: startOfDay, $lte: endOfDay },
      })
      .exec();

    if (sessions.length === 0) {
      return [];
    }

    await this.ensureAutoAbsentForSessions(sessions);

    // Get attendance records for these sessions
    const sessionIds = sessions.map((s) => s._id);
    const records = await this.model
      .find({ sessionId: { $in: sessionIds } })
      .populate('studentId', 'name email')
      .exec();

    return records;
  }

  // Mark attendance from timetable (creates session if not exists)
  async markFromTimetable(user: UserDocument, dto: TimetableAttendanceDto) {
    const classId = new Types.ObjectId(dto.classId);
    const attendanceDate = new Date(dto.date);

    // Set time to noon to avoid timezone issues
    attendanceDate.setHours(12, 0, 0, 0);

    // Set time boundaries for the day
    const startOfDay = new Date(dto.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dto.date);
    endOfDay.setHours(23, 59, 59, 999);

    // Find or create session for this class on this date
    let session = await this.sessionModel
      .findOne({
        classId,
        startTime: { $gte: startOfDay, $lte: endOfDay },
      })
      .exec();

    if (!session) {
      // Create a new session for this timetable entry
      session = new this.sessionModel({
        classId,
        startTime: attendanceDate,
        endTime: new Date(attendanceDate.getTime() + 90 * 60 * 1000), // 90 minutes default
        status: 'approved',
        note: 'Buổi học theo thời khóa biểu',
      });
      await session.save();
    }

    const results: AttendanceDocument[] = [];

    // Mark attendance for each student
    for (const record of dto.records) {
      const studentId = new Types.ObjectId(record.studentId);

      // Check if attendance already exists
      const existing = await this.model
        .findOne({
          sessionId: session._id,
          studentId,
        })
        .exec();

      if (existing) {
        // Update existing record
        existing.status = record.status;
        if (dto.note) existing.note = dto.note;
        await existing.save();
        results.push(existing);
      } else {
        // Create new attendance record
        const attendance = new this.model({
          sessionId: session._id,
          studentId,
          status: record.status,
          note: dto.note,
          markedBy: user._id,
        });
        await attendance.save();
        results.push(attendance);
      }
    }

    return { session, attendanceRecords: results };
  }

  private async ensureAutoAbsentForStudent(studentId: string) {
    const studentObjectId = new Types.ObjectId(studentId);
    const classes = await this.classModel
      .find({ studentIds: studentObjectId })
      .select('_id')
      .exec();

    if (classes.length === 0) {
      return;
    }

    const classIds = classes.map((c) => c._id);
    const now = new Date();
    const sessions = await this.sessionModel
      .find({
        classId: { $in: classIds },
        endTime: { $lte: now },
        status: { $ne: 'cancelled' },
      })
      .select('_id classId endTime status')
      .exec();

    if (sessions.length === 0) {
      return;
    }

    await this.ensureAutoAbsentForSessions(sessions, studentObjectId);
  }

  private async ensureAutoAbsentForSessions(
    sessions: Array<{
      _id: Types.ObjectId | string;
      classId?: Types.ObjectId | string | null;
      endTime: Date;
      status?: string;
    }>,
    onlyStudentId?: Types.ObjectId,
  ) {
    const now = new Date();
    const eligibleSessions = sessions.filter(
      (session) =>
        !!session.classId &&
        session.status !== 'cancelled' &&
        new Date(session.endTime).getTime() <= now.getTime(),
    );

    if (eligibleSessions.length === 0) {
      return;
    }

    const sessionIds = eligibleSessions.map((s) => s._id);
    const classIds = [
      ...new Set(eligibleSessions.map((s) => s.classId!.toString())),
    ].map((id) => new Types.ObjectId(id));

    const classes = await this.classModel
      .find({ _id: { $in: classIds } })
      .select('_id studentIds')
      .exec();

    const studentIdsByClass = new Map<string, string[]>();
    for (const classDoc of classes) {
      const classKey = classDoc._id.toString();
      const studentIds = (classDoc.studentIds || []).map((id) => id.toString());
      studentIdsByClass.set(
        classKey,
        onlyStudentId
          ? studentIds.filter((id) => id === onlyStudentId.toString())
          : studentIds,
      );
    }

    const existingRecords = await this.model
      .find({ sessionId: { $in: sessionIds } })
      .select('sessionId studentId')
      .exec();

    const existingKeys = new Set(
      existingRecords.map(
        (record) => `${record.sessionId.toString()}_${record.studentId.toString()}`,
      ),
    );

    const ops: Parameters<typeof this.model.bulkWrite>[0] = [];

    for (const session of eligibleSessions) {
      const classKey = session.classId!.toString();
      const studentIds = studentIdsByClass.get(classKey) || [];

      for (const studentId of studentIds) {
        const key = `${session._id.toString()}_${studentId}`;
        if (existingKeys.has(key)) {
          continue;
        }

        ops.push({
          updateOne: {
            filter: {
              sessionId: session._id,
              studentId: new Types.ObjectId(studentId),
            },
            update: {
              $setOnInsert: {
                sessionId: session._id,
                studentId: new Types.ObjectId(studentId),
                status: AttendanceStatus.Absent,
                note: 'Tu dong danh vang do giao vien chua diem danh truoc khi ket thuc buoi hoc',
              },
            },
            upsert: true,
          },
        });

        existingKeys.add(key);
      }
    }

    if (ops.length > 0) {
      await this.model.bulkWrite(ops, { ordered: false });
    }
  }

  // Cron job runs every 15 minutes to scan for ended sessions and notify parents
  @Cron(CronExpression.EVERY_15_MINUTES)
  async handleScheduledAttendanceScan() {
    const now = new Date();
    // Look for sessions that ended in the last 30 minutes to catch them exactly once
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const sessions = await this.sessionModel
      .find({
        endTime: { $gte: thirtyMinutesAgo, $lte: now },
        status: 'approved',
      })
      .populate('classId')
      .exec();

    if (sessions.length === 0) return;

    for (const session of sessions) {
      const classDoc = session.classId as unknown as ClassDocument;
      if (!classDoc || !classDoc.studentIds || classDoc.studentIds.length === 0)
        continue;

      const studentIds = classDoc.studentIds.map((id) => id.toString());

      // Check existing records for this session
      const existingRecords = await this.model
        .find({ sessionId: session._id })
        .select('studentId')
        .exec();

      const markedStudentIds = new Set(
        existingRecords.map((r) => r.studentId.toString()),
      );

      const unmarkedStudentIds = studentIds.filter(
        (id) => !markedStudentIds.has(id),
      );

      if (unmarkedStudentIds.length === 0) continue;

      // 1. Mark as Auto-Absent
      const ops = unmarkedStudentIds.map((studentId) => ({
        updateOne: {
          filter: {
            sessionId: session._id,
            studentId: new Types.ObjectId(studentId),
          },
          update: {
            $setOnInsert: {
              sessionId: session._id,
              studentId: new Types.ObjectId(studentId),
              status: AttendanceStatus.Absent,
              note: 'Hệ thống tự động đánh vắng do giáo viên không điểm danh.',
            },
          },
          upsert: true,
        },
      }));

      await this.model.bulkWrite(ops, { ordered: false });

      // 2. Notify Parents & Admin for each absent student
      for (const studentId of unmarkedStudentIds) {
        // Find student details
        const student = await this.userModel.findById(studentId).exec();
        if (!student) continue;

        // Find parent(s)
        const parents = await this.userModel
          .find({
            role: UserRole.Parent,
            childrenIds: studentId,
          })
          .exec();

        const parentIds = parents.map((p) => p._id);

        // Send Push Notification
        const notificationBody = `Thông báo: Học sinh ${student.name} vắng mặt trong buổi học lớp ${classDoc.name} lúc ${session.startTime.toLocaleTimeString('vi-VN')}.`;

        // Notify each parent
        for (const parentId of parentIds) {
          await this.notificationsService.create({
            userId: parentId.toString(),
            title: '⚠️ Cảnh báo vắng học',
            body: notificationBody,
            type: 'warning',
          });
        }

        // Notify Student too
        await this.notificationsService.create({
          userId: studentId,
          title: '⚠️ Bạn đã vắng học',
          body: `Bạn đã bị đánh vắng trong buổi học lớp ${classDoc.name}. Vui lòng liên hệ giáo viên nếu có nhầm lẫn.`,
          type: 'warning',
        });

        // 3. Check for Chronic Absenteeism (High Priority Alert > 20%)
        const stats = await this.getStatistics(studentId);
        if (stats.absent > 1 && stats.total > 0) {
          const absentRate = (stats.absent / stats.total) * 100;
          if (absentRate >= 20) {
            await this.notificationsService.notifyAdmins({
              title: '🚨 ƯU TIÊN: CẦN GỌI ĐIỆN PHỤ HUYNH',
              body: `Học sinh ${student.name} (${student.studentCode}) lớp ${classDoc.name} đã nghỉ ${stats.absent}/${stats.total} buổi (${absentRate.toFixed(1)}%). Vui lòng gọi điện cho PH: ${student.parentPhone || 'Chưa cập nhật'}.`,
              type: 'urgent',
            });
          }
        }
      }
    }
  }

  // Get statistics for a student
  async getStatistics(studentId: string) {
    await this.ensureAutoAbsentForStudent(studentId);

    const records = await this.model
      .find({ studentId: new Types.ObjectId(studentId) })
      .exec();

    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const total = records.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, late, total, rate };
  }

  // Get attendance streak for a student
  async getStreak(studentId: string) {
    await this.ensureAutoAbsentForStudent(studentId);

    const records = await this.model
      .find({ studentId: new Types.ObjectId(studentId) })
      .populate('sessionId', 'startTime')
      .sort({ createdAt: -1 })
      .exec();

    if (records.length === 0) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        totalPresent: 0,
        totalSessions: 0,
      };
    }

    // Get unique session dates sorted descending
    const sessionDates: string[] = [];
    const statusByDate: Record<string, string> = {};

    for (const r of records) {
      const session = r.sessionId as any;
      const dateStr = session?.startTime
        ? new Date(session.startTime).toISOString().split('T')[0]
        : new Date(r.createdAt!).toISOString().split('T')[0];

      if (!statusByDate[dateStr]) {
        statusByDate[dateStr] = r.status;
        sessionDates.push(dateStr);
      }
    }

    // Sort dates descending (most recent first)
    sessionDates.sort((a, b) => b.localeCompare(a));

    // Calculate current streak (consecutive present days from most recent)
    let currentStreak = 0;
    for (const date of sessionDates) {
      if (statusByDate[date] === 'present' || statusByDate[date] === 'late') {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate best streak
    let bestStreak = 0;
    let tempStreak = 0;
    // Sort ascending for best streak calculation
    const sortedAsc = [...sessionDates].sort((a, b) => a.localeCompare(b));
    for (const date of sortedAsc) {
      if (statusByDate[date] === 'present' || statusByDate[date] === 'late') {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    const totalPresent = records.filter(
      (r) => r.status === 'present' || r.status === 'late',
    ).length;

    return {
      currentStreak,
      bestStreak,
      totalPresent,
      totalSessions: records.length,
    };
  }
}
