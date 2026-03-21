import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ClassPaymentRequest,
  ClassPaymentRequestDocument,
  ClassPaymentRequestStatus,
  FinancialRiskLevel,
} from './schemas/class-payment-request.schema';
import {
  StudentPaymentRequest,
  StudentPaymentRequestDocument,
  StudentPaymentRequestStatus,
} from './schemas/student-payment-request.schema';
import { CreateClassPaymentRequestDto } from './dto/create-class-payment-request.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ClassEntity, ClassDocument } from '../classes/schemas/class.schema';

interface FinancialInputs {
  expectedCollectionRate: number;
  estimatedCost: number;
  minProfitTarget: number;
  scholarshipCapPercent: number;
  capExceedPolicy: 'block' | 'request_exception';
  capExceedReason?: string;
}

interface FinancialSnapshot {
  listedRevenue: number;
  scholarshipDiscountTotal: number;
  scholarshipDiscountRatio: number;
  expectedCollectionRate: number;
  estimatedRevenue: number;
  estimatedCost: number;
  minProfitTarget: number;
  projectedProfit: number;
  discountCapAmount: number;
  discountCapPercent: number;
  collectedRevenue: number;
  outstandingAmount: number;
  overdueDebtAmount: number;
  actualCollectionRate: number;
  actualProfit: number;
  riskLevel: FinancialRiskLevel;
  isCapExceeded: boolean;
  capExceedPolicy: 'block' | 'request_exception';
  capExceedReason?: string;
  snapshotAt: Date;
}

@Injectable()
export class PaymentRequestsService {
  constructor(
    @InjectModel(ClassPaymentRequest.name)
    private classRequestModel: Model<ClassPaymentRequestDocument>,
    @InjectModel(StudentPaymentRequest.name)
    private studentRequestModel: Model<StudentPaymentRequestDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ClassEntity.name) private classModel: Model<ClassDocument>,
  ) {}

  // ==================== ADMIN METHODS ====================

  async createClassPaymentRequest(
    dto: CreateClassPaymentRequestDto,
    adminId: string,
  ): Promise<{ classRequest: ClassPaymentRequest; studentCount: number }> {
    // 1. Validate class
    const classEntity = await this.classModel.findById(dto.classId);
    if (!classEntity) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    const studentIds = classEntity.studentIds || [];
    if (studentIds.length === 0) {
      throw new BadRequestException('Lớp học chưa có học sinh nào');
    }

    // 2. Lấy amount từ class.fee nếu không truyền
    const amount = dto.amount || (classEntity as any).fee || 0;
    if (amount <= 0) {
      throw new BadRequestException('Số tiền phải lớn hơn 0');
    }

    const financialInputs = this.getFinancialInputs(dto);

    // 3. Tạo ClassPaymentRequest
    const classRequest = new this.classRequestModel({
      classId: new Types.ObjectId(dto.classId),
      title: dto.title,
      description: dto.description,
      amount,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      createdBy: new Types.ObjectId(adminId),
      className: classEntity.name,
      classSubject: classEntity.subject,
      totalStudents: studentIds.length,
      paidCount: 0,
      totalCollected: 0,
      status: ClassPaymentRequestStatus.ACTIVE,
    });

    // 4. Lấy thông tin tất cả học sinh
    const students = await this.userModel.find({
      _id: { $in: studentIds },
    });

    // 5. Tạo StudentPaymentRequest cho từng học sinh
    const studentRequests = students.map((student) => {
      const scholarshipPercent =
        student.hasScholarship && student.scholarshipPercent
          ? student.scholarshipPercent
          : 0;
      const discountAmount = Math.floor((amount * scholarshipPercent) / 100);
      const finalAmount = Math.max(amount - discountAmount, 0);

      return {
        classPaymentRequestId: classRequest._id,
        classId: new Types.ObjectId(dto.classId),
        studentId: student._id,
        studentName: student.name,
        studentCode: student.studentCode,
        className: classEntity.name,
        classSubject: classEntity.subject,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        baseAmount: amount,
        scholarshipPercent,
        scholarshipType: student.scholarshipType,
        discountAmount,
        finalAmount,
        status:
          finalAmount === 0
            ? StudentPaymentRequestStatus.PAID
            : StudentPaymentRequestStatus.PENDING,
        paidAt: finalAmount === 0 ? new Date() : undefined,
      };
    });

    const initialSnapshot = this.buildFinancialSnapshot(
      amount,
      studentRequests,
      financialInputs,
      0,
      0,
    );

    if (
      initialSnapshot.isCapExceeded &&
      financialInputs.capExceedPolicy === 'block'
    ) {
      throw new BadRequestException(
        `Tổng học bổng vượt trần an toàn (${initialSnapshot.discountCapPercent.toFixed(1)}%). Vui lòng điều chỉnh lớp hoặc chuyển sang quy trình ngoại lệ.`,
      );
    }

    classRequest.financialSnapshot = initialSnapshot;
    if (
      initialSnapshot.isCapExceeded &&
      financialInputs.capExceedPolicy === 'request_exception'
    ) {
      classRequest.status = ClassPaymentRequestStatus.PENDING_EXCEPTION;
    }

    await classRequest.save();
    await this.studentRequestModel.insertMany(studentRequests);

    // 6. Cập nhật paidCount nếu có miễn phí
    const freeCount = studentRequests.filter(
      (r) => r.status === StudentPaymentRequestStatus.PAID,
    ).length;
    if (freeCount > 0) {
      classRequest.paidCount = freeCount;
      await this.recomputeClassFinancialSnapshot(
        (classRequest._id as Types.ObjectId).toString(),
      );
    }

    return { classRequest, studentCount: studentRequests.length };
  }

  async getClassPaymentRequests(
    classId?: string,
  ): Promise<ClassPaymentRequest[]> {
    const query: any = {
      status: {
        $in: [
          ClassPaymentRequestStatus.ACTIVE,
          ClassPaymentRequestStatus.PENDING_EXCEPTION,
        ],
      },
    };
    if (classId) {
      query.classId = new Types.ObjectId(classId);
    }
    return this.classRequestModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('classId', 'name subject')
      .populate('createdBy', 'name email');
  }

  async getClassPaymentRequestById(id: string): Promise<ClassPaymentRequest> {
    const request = await this.classRequestModel
      .findById(id)
      .populate('classId', 'name subject')
      .populate('createdBy', 'name email');
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu');
    }
    return request;
  }

  async getStudentsByClassRequest(classRequestId: string): Promise<{
    total: number;
    paid: number;
    pending: number;
    students: StudentPaymentRequest[];
  }> {
    const students = await this.studentRequestModel
      .find({ classPaymentRequestId: new Types.ObjectId(classRequestId) })
      .populate('studentId', 'name email studentCode')
      .sort({ studentName: 1 });

    const paid = students.filter(
      (s) => s.status === StudentPaymentRequestStatus.PAID,
    ).length;
    const pending = students.filter(
      (s) => s.status === StudentPaymentRequestStatus.PENDING,
    ).length;

    return {
      total: students.length,
      paid,
      pending,
      students,
    };
  }

  async cancelClassPaymentRequest(id: string): Promise<void> {
    const request = await this.classRequestModel.findById(id);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu');
    }

    // Hủy tất cả student requests chưa thanh toán
    await this.studentRequestModel.updateMany(
      {
        classPaymentRequestId: new Types.ObjectId(id),
        status: StudentPaymentRequestStatus.PENDING,
      },
      { status: StudentPaymentRequestStatus.CANCELLED },
    );

    request.status = ClassPaymentRequestStatus.CANCELLED;
    await request.save();
  }

  async approveException(
    classRequestId: string,
    adminId: string,
  ): Promise<ClassPaymentRequest> {
    const request = await this.classRequestModel.findById(classRequestId);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu');
    }

    if (request.status !== ClassPaymentRequestStatus.PENDING_EXCEPTION) {
      throw new BadRequestException('Yêu cầu không ở trạng thái chờ ngoại lệ');
    }

    request.status = ClassPaymentRequestStatus.ACTIVE;
    if (request.financialSnapshot) {
      request.financialSnapshot.exceptionApprovedAt = new Date();
      request.financialSnapshot.exceptionApprovedBy = new Types.ObjectId(
        adminId,
      );
      request.financialSnapshot.exceptionRejectedAt = undefined;
      request.financialSnapshot.exceptionRejectedBy = undefined;
      request.financialSnapshot.exceptionRejectedReason = undefined;
      request.financialSnapshot.snapshotAt = new Date();
    }
    await request.save();
    return request;
  }

  async rejectException(
    classRequestId: string,
    adminId: string,
    reason?: string,
  ): Promise<ClassPaymentRequest> {
    const request = await this.classRequestModel.findById(classRequestId);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu');
    }

    if (request.status !== ClassPaymentRequestStatus.PENDING_EXCEPTION) {
      throw new BadRequestException('Yêu cầu không ở trạng thái chờ ngoại lệ');
    }

    request.status = ClassPaymentRequestStatus.CANCELLED;
    if (request.financialSnapshot) {
      request.financialSnapshot.exceptionRejectedAt = new Date();
      request.financialSnapshot.exceptionRejectedBy = new Types.ObjectId(
        adminId,
      );
      request.financialSnapshot.exceptionRejectedReason = reason;
      request.financialSnapshot.snapshotAt = new Date();
    }

    await this.studentRequestModel.updateMany(
      {
        classPaymentRequestId: new Types.ObjectId(classRequestId),
        status: StudentPaymentRequestStatus.PENDING,
      },
      { status: StudentPaymentRequestStatus.CANCELLED },
    );

    await request.save();
    return request;
  }

  // ==================== STUDENT METHODS ====================

  async getStudentPaymentRequests(
    studentId: string,
    status?: StudentPaymentRequestStatus,
  ): Promise<StudentPaymentRequest[]> {
    const query: any = { studentId: new Types.ObjectId(studentId) };
    if (status) {
      query.status = status;
    } else {
      // Mặc định lấy pending và overdue
      query.status = {
        $in: [
          StudentPaymentRequestStatus.PENDING,
          StudentPaymentRequestStatus.OVERDUE,
        ],
      };
    }
    return this.studentRequestModel.find(query).sort({ dueDate: 1 });
  }

  async getAllStudentPaymentRequests(
    studentId: string,
  ): Promise<StudentPaymentRequest[]> {
    return this.studentRequestModel
      .find({ studentId: new Types.ObjectId(studentId) })
      .sort({ createdAt: -1 });
  }

  async getStudentPaymentRequestById(
    id: string,
  ): Promise<StudentPaymentRequest> {
    const request = await this.studentRequestModel.findById(id);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu');
    }
    return request;
  }

  // ==================== PARENT METHODS ====================

  async getChildrenPaymentRequests(
    parentId: string,
  ): Promise<
    {
      studentId: string;
      studentName: string;
      requests: StudentPaymentRequest[];
    }[]
  > {
    // Lấy parent
    const parent = await this.userModel.findById(parentId);
    if (!parent || !parent.childEmail) {
      return [];
    }

    // Tìm student theo childEmail
    const child = await this.userModel.findOne({ email: parent.childEmail });
    if (!child) {
      return [];
    }

    // Lấy requests của con
    const requests = await this.studentRequestModel
      .find({
        studentId: child._id,
      })
      .sort({ createdAt: -1 });

    return [
      {
        studentId: (child._id as Types.ObjectId).toString(),
        studentName: child.name,
        requests,
      },
    ];
  }

  // ==================== PAYMENT HELPERS ====================

  async markAsPaid(
    requestIds: string[],
    paymentId: Types.ObjectId,
  ): Promise<void> {
    const objectIds = requestIds.map((id) => new Types.ObjectId(id));

    // Update student requests
    await this.studentRequestModel.updateMany(
      { _id: { $in: objectIds } },
      {
        status: StudentPaymentRequestStatus.PAID,
        paidAt: new Date(),
        paymentId,
      },
    );

    // Update class request stats
    const requests = await this.studentRequestModel.find({
      _id: { $in: objectIds },
    });

    const classRequestIds = [
      ...new Set(requests.map((r) => r.classPaymentRequestId.toString())),
    ];

    for (const classRequestId of classRequestIds) {
      const paidRequests = await this.studentRequestModel.find({
        classPaymentRequestId: new Types.ObjectId(classRequestId),
        status: StudentPaymentRequestStatus.PAID,
      });

      const totalCollected = paidRequests.reduce(
        (sum, r) => sum + r.finalAmount,
        0,
      );

      await this.classRequestModel.findByIdAndUpdate(classRequestId, {
        paidCount: paidRequests.length,
        totalCollected,
      });

      await this.recomputeClassFinancialSnapshot(classRequestId);
    }
  }

  async validateRequestsForPayment(
    requestIds: string[],
    studentId: string,
  ): Promise<{ requests: StudentPaymentRequest[]; totalAmount: number }> {
    const requests = await this.studentRequestModel.find({
      _id: { $in: requestIds.map((id) => new Types.ObjectId(id)) },
      studentId: new Types.ObjectId(studentId),
      status: {
        $in: [
          StudentPaymentRequestStatus.PENDING,
          StudentPaymentRequestStatus.OVERDUE,
        ],
      },
    });

    if (requests.length !== requestIds.length) {
      throw new BadRequestException(
        'Một số yêu cầu không hợp lệ hoặc đã được thanh toán',
      );
    }

    const classRequestIds = [
      ...new Set(requests.map((r) => r.classPaymentRequestId.toString())),
    ];
    const classRequests = await this.classRequestModel.find({
      _id: { $in: classRequestIds.map((id) => new Types.ObjectId(id)) },
    });

    const hasBlockedClassRequest = classRequests.some(
      (r) => r.status !== ClassPaymentRequestStatus.ACTIVE,
    );
    if (hasBlockedClassRequest) {
      throw new BadRequestException(
        'Yêu cầu học phí đang chờ duyệt ngoại lệ hoặc đã bị hủy, chưa thể thanh toán',
      );
    }

    const totalAmount = requests.reduce((sum, r) => sum + r.finalAmount, 0);

    return { requests, totalAmount };
  }

  private getFinancialInputs(
    dto: CreateClassPaymentRequestDto,
  ): FinancialInputs {
    return {
      expectedCollectionRate: dto.expectedCollectionRate ?? 0.97,
      estimatedCost: dto.estimatedCost ?? 0,
      minProfitTarget: dto.minProfitTarget ?? 0,
      scholarshipCapPercent: dto.scholarshipCapPercent ?? 40,
      capExceedPolicy: dto.capExceedPolicy ?? 'block',
      capExceedReason: dto.capExceedReason,
    };
  }

  private computeRiskLevel(snapshot: FinancialSnapshot): FinancialRiskLevel {
    if (snapshot.actualProfit < 0 || snapshot.isCapExceeded) {
      return 'red';
    }

    const profitGapRatio =
      snapshot.minProfitTarget <= 0
        ? 1
        : snapshot.actualProfit / snapshot.minProfitTarget;

    if (profitGapRatio < 0.8 || snapshot.actualCollectionRate < 0.85) {
      return 'yellow';
    }

    return 'green';
  }

  private buildFinancialSnapshot(
    amount: number,
    studentRequests: Array<{
      discountAmount: number;
      finalAmount: number;
      status: StudentPaymentRequestStatus;
      dueDate?: Date;
    }>,
    inputs: FinancialInputs,
    collectedRevenue: number,
    overdueDebtAmount: number,
  ): FinancialSnapshot {
    const studentCount = studentRequests.length;
    const listedRevenue = amount * studentCount;
    const scholarshipDiscountTotal = studentRequests.reduce(
      (sum, r) => sum + r.discountAmount,
      0,
    );
    const scholarshipDiscountRatio =
      listedRevenue > 0 ? scholarshipDiscountTotal / listedRevenue : 0;
    const estimatedRevenue =
      (listedRevenue - scholarshipDiscountTotal) *
      inputs.expectedCollectionRate;
    const projectedProfit = estimatedRevenue - inputs.estimatedCost;

    const discountCapAmount =
      listedRevenue -
      (inputs.estimatedCost + inputs.minProfitTarget) /
        Math.max(inputs.expectedCollectionRate, 0.01);

    const capByPercent =
      listedRevenue * (Math.max(0, inputs.scholarshipCapPercent) / 100);
    const effectiveCap = Math.max(0, Math.min(discountCapAmount, capByPercent));
    const isCapExceeded = scholarshipDiscountTotal > effectiveCap;

    const outstandingAmount = Math.max(
      studentRequests.reduce((sum, r) => sum + r.finalAmount, 0) -
        collectedRevenue,
      0,
    );
    const actualCollectionRate =
      listedRevenue > 0 ? collectedRevenue / listedRevenue : 0;
    const actualProfit = collectedRevenue - inputs.estimatedCost;

    const snapshot: FinancialSnapshot = {
      listedRevenue,
      scholarshipDiscountTotal,
      scholarshipDiscountRatio,
      expectedCollectionRate: inputs.expectedCollectionRate,
      estimatedRevenue,
      estimatedCost: inputs.estimatedCost,
      minProfitTarget: inputs.minProfitTarget,
      projectedProfit,
      discountCapAmount: effectiveCap,
      discountCapPercent: inputs.scholarshipCapPercent,
      collectedRevenue,
      outstandingAmount,
      overdueDebtAmount,
      actualCollectionRate,
      actualProfit,
      riskLevel: 'green',
      isCapExceeded,
      capExceedPolicy: inputs.capExceedPolicy,
      capExceedReason: inputs.capExceedReason,
      snapshotAt: new Date(),
    };

    snapshot.riskLevel = this.computeRiskLevel(snapshot);
    return snapshot;
  }

  private async recomputeClassFinancialSnapshot(
    classRequestId: string,
  ): Promise<void> {
    const classRequest = await this.classRequestModel.findById(classRequestId);
    if (!classRequest || !classRequest.financialSnapshot) {
      return;
    }

    const students = await this.studentRequestModel.find({
      classPaymentRequestId: new Types.ObjectId(classRequestId),
    });

    const collectedRevenue = students
      .filter((r) => r.status === StudentPaymentRequestStatus.PAID)
      .reduce((sum, r) => sum + r.finalAmount, 0);

    const now = new Date();
    const overdueDebtAmount = students
      .filter(
        (r) =>
          r.status !== StudentPaymentRequestStatus.PAID &&
          r.status !== StudentPaymentRequestStatus.CANCELLED &&
          r.dueDate &&
          r.dueDate < now,
      )
      .reduce((sum, r) => sum + r.finalAmount, 0);

    const snapshot = this.buildFinancialSnapshot(
      classRequest.amount,
      students,
      {
        expectedCollectionRate:
          classRequest.financialSnapshot.expectedCollectionRate ?? 0.97,
        estimatedCost: classRequest.financialSnapshot.estimatedCost ?? 0,
        minProfitTarget: classRequest.financialSnapshot.minProfitTarget ?? 0,
        scholarshipCapPercent:
          classRequest.financialSnapshot.discountCapPercent ?? 40,
        capExceedPolicy:
          classRequest.financialSnapshot.capExceedPolicy ?? 'block',
        capExceedReason: classRequest.financialSnapshot.capExceedReason,
      },
      collectedRevenue,
      overdueDebtAmount,
    );

    classRequest.financialSnapshot = {
      ...classRequest.financialSnapshot,
      ...snapshot,
    };

    classRequest.paidCount = students.filter(
      (r) => r.status === StudentPaymentRequestStatus.PAID,
    ).length;
    classRequest.totalCollected = collectedRevenue;
    await classRequest.save();
  }
}
