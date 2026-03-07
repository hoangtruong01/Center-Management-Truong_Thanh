import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { TimetableAttendanceDto } from './dto/timetable-attendance.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly model: Model<AttendanceDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  async mark(user: UserDocument, dto: CreateAttendanceDto) {
    const doc = new this.model({
      ...dto,
      sessionId: new Types.ObjectId(dto.sessionId),
      studentId: new Types.ObjectId(dto.studentId),
      markedBy: user._id,
    });
    return doc.save();
  }

  listBySession(sessionId: string) {
    return this.model
      .find({ sessionId })
      .populate('studentId', 'name email')
      .exec();
  }

  listByStudent(studentId: string) {
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

  // Get statistics for a student
  async getStatistics(studentId: string) {
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
