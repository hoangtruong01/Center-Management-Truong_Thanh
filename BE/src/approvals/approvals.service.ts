import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ApprovalRequest,
  ApprovalRequestDocument,
  ApprovalStatus,
  ApprovalType,
} from './schemas/approval-request.schema';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../common/enums/user-status.enum';
import { ClassesService } from '../classes/classes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateClassTransferRequestDto } from './dto/create-class-transfer-request.dto';

type TransferAuditLog = {
  action: 'requested' | 'approved' | 'rejected' | 'executed';
  by?: string;
  at: Date;
  note?: string;
};

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectModel(ApprovalRequest.name)
    private readonly approvalModel: Model<ApprovalRequestDocument>,
    private readonly usersService: UsersService,
    private readonly classesService: ClassesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRegisterRequest(userId: string) {
    return this.approvalModel.create({
      userId,
      type: ApprovalType.Register,
      status: ApprovalStatus.Pending,
    });
  }

  async createPasswordResetRequest(userId: string, email: string) {
    return this.approvalModel.create({
      userId,
      type: ApprovalType.PasswordReset,
      status: ApprovalStatus.Pending,
      metadata: { email, requestedAt: new Date() },
    });
  }

  async createContactRequest(dto: {
    name: string;
    email: string;
    phone?: string;
    message: string;
    type: string;
  }) {
    return this.approvalModel.create({
      type: ApprovalType.Contact,
      status: ApprovalStatus.Pending,
      metadata: {
        ...dto,
        requestedAt: new Date(),
      },
    });
  }

  async listPending() {
    return this.approvalModel
      .find({
        status: ApprovalStatus.Pending,
        type: { $ne: ApprovalType.ClassTransfer },
      })
      .lean();
  }

  async createClassTransferRequest(
    dto: CreateClassTransferRequestDto,
    requestedBy: string,
  ) {
    if (dto.fromClassId === dto.toClassId) {
      throw new BadRequestException('Lớp chuyển đến phải khác lớp hiện tại');
    }

    const [student, fromClass, toClass] = await Promise.all([
      this.usersService.findById(dto.studentId),
      this.classesService.findOne(dto.fromClassId),
      this.classesService.findOne(dto.toClassId),
    ]);

    const inFromClass = fromClass.studentIds?.some(
      (id: any) => id.toString() === dto.studentId,
    );
    if (!inFromClass) {
      throw new BadRequestException('Học sinh không thuộc lớp hiện tại');
    }

    const duplicatedPending = await this.approvalModel.findOne({
      type: ApprovalType.ClassTransfer,
      status: ApprovalStatus.Pending,
      'metadata.studentId': dto.studentId,
      'metadata.fromClassId': dto.fromClassId,
      'metadata.toClassId': dto.toClassId,
    });

    if (duplicatedPending) {
      throw new BadRequestException('Yêu cầu chuyển lớp này đang chờ duyệt');
    }

    const conflictCheck =
      await this.classesService.checkStudentScheduleConflict(
        dto.studentId,
        dto.toClassId,
        dto.fromClassId,
      );

    const created = await this.approvalModel.create({
      type: ApprovalType.ClassTransfer,
      status: ApprovalStatus.Pending,
      metadata: {
        studentId: dto.studentId,
        studentName: student.name,
        fromClassId: dto.fromClassId,
        fromClassName: fromClass.name,
        toClassId: dto.toClassId,
        toClassName: toClass.name,
        reason: dto.reason,
        requestedBy,
        requestedAt: new Date(),
        initialConflict: conflictCheck,
        auditLogs: [
          {
            action: 'requested',
            by: requestedBy,
            at: new Date(),
            note: dto.reason,
          } satisfies TransferAuditLog,
        ],
      },
    });

    return created;
  }

  async listClassTransferRequests(status?: ApprovalStatus, keyword?: string) {
    const query: Record<string, any> = { type: ApprovalType.ClassTransfer };
    if (status) {
      query.status = status;
    }

    if (keyword?.trim()) {
      const kw = keyword.trim();
      query.$or = [
        { 'metadata.studentName': { $regex: kw, $options: 'i' } },
        { 'metadata.fromClassName': { $regex: kw, $options: 'i' } },
        { 'metadata.toClassName': { $regex: kw, $options: 'i' } },
      ];
    }

    return this.approvalModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async approveClassTransferRequest(requestId: string, adminId: string) {
    const req = await this.approvalModel
      .findOne({
        _id: requestId,
        type: ApprovalType.ClassTransfer,
        status: ApprovalStatus.Pending,
      })
      .exec();

    if (!req) {
      throw new NotFoundException(
        'Yêu cầu chuyển lớp không tồn tại hoặc đã xử lý',
      );
    }

    const studentId = req.metadata?.studentId as string;
    const fromClassId = req.metadata?.fromClassId as string;
    const toClassId = req.metadata?.toClassId as string;

    if (!studentId || !fromClassId || !toClassId) {
      throw new BadRequestException('Dữ liệu yêu cầu chuyển lớp không hợp lệ');
    }

    const [fromClass, student] = await Promise.all([
      this.classesService.findOne(fromClassId),
      this.usersService.findById(studentId),
    ]);

    const conflictCheck =
      await this.classesService.checkStudentScheduleConflict(
        studentId,
        toClassId,
        fromClassId,
      );

    if (conflictCheck.hasConflict) {
      const dayNames = [
        'Chủ nhật',
        'Thứ 2',
        'Thứ 3',
        'Thứ 4',
        'Thứ 5',
        'Thứ 6',
        'Thứ 7',
      ];
      const conflictDetails = conflictCheck.conflicts
        .map((item) => {
          const dayLabel = dayNames[item.dayOfWeek] || `Thứ ${item.dayOfWeek}`;
          const subjectPart = item.subject ? ` - ${item.subject}` : '';
          return `${item.className}${subjectPart} (${dayLabel} ${item.startTime}-${item.endTime})`;
        })
        .join('; ');

      throw new BadRequestException(
        `Không thể duyệt vì trùng lịch: ${conflictDetails}`,
      );
    }

    const updatedClass =
      await this.classesService.transferStudentBetweenClasses(
        fromClassId,
        toClassId,
        studentId,
      );

    const existingLogs = (req.metadata?.auditLogs || []) as TransferAuditLog[];

    const teacherIdRaw: any = (updatedClass as any).teacherId;
    const teacherId =
      typeof teacherIdRaw === 'object' && teacherIdRaw?._id
        ? teacherIdRaw._id.toString()
        : teacherIdRaw?.toString();

    const fromTeacherRaw: any = (fromClass as any).teacherId;
    const fromTeacherId =
      typeof fromTeacherRaw === 'object' && fromTeacherRaw?._id
        ? fromTeacherRaw._id.toString()
        : fromTeacherRaw?.toString();

    const parentUsers = await this.usersService.findParentsForStudent({
      studentId,
      email: student.email,
      parentPhone: student.parentPhone,
    });

    const studentName =
      req.metadata?.studentName || student.name || 'Một học sinh';
    const notifiedUsers = new Set<string>();

    if (teacherId) {
      await this.notificationsService.create({
        userId: teacherId,
        title: 'Học sinh mới tham gia lớp',
        body: `${studentName} đã được duyệt chuyển vào lớp ${updatedClass.name}.`,
        type: 'class_transfer',
      });
      notifiedUsers.add(teacherId);
    }

    if (fromTeacherId && !notifiedUsers.has(fromTeacherId)) {
      await this.notificationsService.create({
        userId: fromTeacherId,
        title: 'Học sinh đã chuyển lớp',
        body: `${studentName} đã được duyệt chuyển khỏi lớp ${fromClass.name}.`,
        type: 'class_transfer',
      });
      notifiedUsers.add(fromTeacherId);
    }

    for (const parent of parentUsers) {
      const parentId = (parent as any)._id?.toString();
      if (!parentId || notifiedUsers.has(parentId)) continue;

      await this.notificationsService.create({
        userId: parentId,
        title: 'Yêu cầu chuyển lớp đã được duyệt',
        body: `${studentName} đã được chuyển từ lớp ${fromClass.name} sang lớp ${updatedClass.name}.`,
        type: 'class_transfer',
      });
      notifiedUsers.add(parentId);
    }

    await this.approvalModel
      .findByIdAndUpdate(req._id, {
        status: ApprovalStatus.Approved,
        approvedBy: adminId,
        metadata: {
          ...req.metadata,
          approvedAt: new Date(),
          conflictAtApproval: conflictCheck,
          notifiedUsers: Array.from(notifiedUsers),
          auditLogs: [
            ...existingLogs,
            {
              action: 'approved',
              by: adminId,
              at: new Date(),
            } satisfies TransferAuditLog,
            {
              action: 'executed',
              by: adminId,
              at: new Date(),
              note: `Chuyển ${studentName}: ${fromClass.name} -> ${updatedClass.name}`,
            } satisfies TransferAuditLog,
          ],
        },
      })
      .exec();

    return {
      requestId,
      status: ApprovalStatus.Approved,
      classId: toClassId,
    };
  }

  async rejectClassTransferRequest(
    requestId: string,
    adminId: string,
    reason?: string,
  ) {
    const req = await this.approvalModel
      .findOne({
        _id: requestId,
        type: ApprovalType.ClassTransfer,
        status: ApprovalStatus.Pending,
      })
      .exec();

    if (!req) {
      throw new NotFoundException(
        'Yêu cầu chuyển lớp không tồn tại hoặc đã xử lý',
      );
    }

    const existingLogs = (req.metadata?.auditLogs || []) as TransferAuditLog[];

    await this.approvalModel
      .findByIdAndUpdate(req._id, {
        status: ApprovalStatus.Rejected,
        approvedBy: adminId,
        metadata: {
          ...req.metadata,
          rejectedAt: new Date(),
          rejectReason: reason,
          auditLogs: [
            ...existingLogs,
            {
              action: 'rejected',
              by: adminId,
              at: new Date(),
              note: reason,
            } satisfies TransferAuditLog,
          ],
        },
      })
      .exec();

    return { requestId, status: ApprovalStatus.Rejected };
  }

  async bulkApproveClassTransferRequests(
    requestIds: string[],
    adminId: string,
  ) {
    const uniqueIds = Array.from(new Set(requestIds.filter(Boolean)));
    const failures: Array<{ requestId: string; error: string }> = [];
    let success = 0;

    for (const requestId of uniqueIds) {
      try {
        await this.approveClassTransferRequest(requestId, adminId);
        success += 1;
      } catch (error) {
        failures.push({
          requestId,
          error:
            error instanceof Error ? error.message : 'Không thể duyệt yêu cầu',
        });
      }
    }

    return {
      total: uniqueIds.length,
      success,
      failed: failures.length,
      failures,
    };
  }

  async bulkRejectClassTransferRequests(
    requestIds: string[],
    adminId: string,
    reason?: string,
  ) {
    const uniqueIds = Array.from(new Set(requestIds.filter(Boolean)));
    const failures: Array<{ requestId: string; error: string }> = [];
    let success = 0;

    for (const requestId of uniqueIds) {
      try {
        await this.rejectClassTransferRequest(requestId, adminId, reason);
        success += 1;
      } catch (error) {
        failures.push({
          requestId,
          error:
            error instanceof Error
              ? error.message
              : 'Không thể từ chối yêu cầu',
        });
      }
    }

    return {
      total: uniqueIds.length,
      success,
      failed: failures.length,
      failures,
    };
  }

  async approveRegister(userId: string, adminId: string) {
    const req = await this.approvalModel
      .findOne({
        userId,
        type: ApprovalType.Register,
        status: ApprovalStatus.Pending,
      })
      .exec();
    if (!req) throw new NotFoundException('Pending approval not found');
    await this.usersService.update(userId, {
      status: UserStatus.Active,
    } as any);
    await this.approvalModel
      .findByIdAndUpdate(req._id, {
        status: ApprovalStatus.Approved,
        approvedBy: adminId,
      })
      .exec();
    return { userId, status: ApprovalStatus.Approved };
  }
}
