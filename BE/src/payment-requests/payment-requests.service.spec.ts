/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Types } from 'mongoose';
import { PaymentRequestsService } from './payment-requests.service';
import { ClassPaymentRequestStatus } from './schemas/class-payment-request.schema';
import { StudentPaymentRequestStatus } from './schemas/student-payment-request.schema';

describe('PaymentRequestsService financial controls', () => {
  const classRequestCtor = jest.fn();
  const classRequestModel: any = classRequestCtor;
  classRequestModel.findById = jest.fn();
  classRequestModel.find = jest.fn();
  classRequestModel.findByIdAndUpdate = jest.fn();

  const studentRequestModel: any = {
    insertMany: jest.fn(),
    updateMany: jest.fn(),
    find: jest.fn(),
  };

  const userModel: any = {
    find: jest.fn(),
  };

  const classModel: any = {
    findById: jest.fn(),
  };

  const service = new PaymentRequestsService(
    classRequestModel,
    studentRequestModel,
    userModel,
    classModel,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    classRequestCtor.mockImplementation((payload: any) => ({
      _id: new Types.ObjectId(),
      ...payload,
      save: jest.fn().mockImplementation(async () => undefined),
    }));
  });

  it('blocks class request when scholarship cap is exceeded and policy is block', async () => {
    const classId = new Types.ObjectId().toString();

    classModel.findById.mockResolvedValue({
      _id: classId,
      name: 'Lop 9A',
      subject: 'Toan',
      fee: 1000,
      studentIds: [new Types.ObjectId()],
    });

    userModel.find.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        name: 'Hoc sinh A',
        hasScholarship: true,
        scholarshipPercent: 90,
      },
    ]);

    await expect(
      service.createClassPaymentRequest(
        {
          classId,
          title: 'Hoc phi thang 3',
          expectedCollectionRate: 1,
          estimatedCost: 700,
          minProfitTarget: 200,
          scholarshipCapPercent: 50,
          capExceedPolicy: 'block',
        },
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentRequestModel.insertMany).not.toHaveBeenCalled();
  });

  it('creates pending_exception when scholarship cap is exceeded and policy requests exception', async () => {
    const classId = new Types.ObjectId().toString();

    classModel.findById.mockResolvedValue({
      _id: classId,
      name: 'Lop 9A',
      subject: 'Toan',
      fee: 1000,
      studentIds: [new Types.ObjectId()],
    });

    userModel.find.mockResolvedValue([
      {
        _id: new Types.ObjectId(),
        name: 'Hoc sinh A',
        hasScholarship: true,
        scholarshipPercent: 90,
      },
    ]);

    const result = await service.createClassPaymentRequest(
      {
        classId,
        title: 'Hoc phi thang 3',
        expectedCollectionRate: 1,
        estimatedCost: 700,
        minProfitTarget: 200,
        scholarshipCapPercent: 50,
        capExceedPolicy: 'request_exception',
        capExceedReason: 'Lop dac biet',
      },
      new Types.ObjectId().toString(),
    );

    expect(result.classRequest.status).toBe(
      ClassPaymentRequestStatus.PENDING_EXCEPTION,
    );
    expect(result.classRequest.financialSnapshot?.isCapExceeded).toBe(true);
    expect(studentRequestModel.insertMany).toHaveBeenCalledTimes(1);
  });

  it('approves exception and moves request back to active', async () => {
    const requestDoc: any = {
      status: ClassPaymentRequestStatus.PENDING_EXCEPTION,
      financialSnapshot: {
        expectedCollectionRate: 1,
        estimatedCost: 200,
        minProfitTarget: 100,
        discountCapPercent: 40,
        capExceedPolicy: 'request_exception',
      },
      save: jest.fn().mockImplementation(async () => undefined),
    };
    classRequestModel.findById.mockResolvedValue(requestDoc);

    const out = await service.approveException(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
    );

    expect(out.status).toBe(ClassPaymentRequestStatus.ACTIVE);
    expect(out.financialSnapshot?.exceptionApprovedAt).toBeDefined();
    expect(requestDoc.save).toHaveBeenCalled();
  });

  it('recalculates risk snapshot after markAsPaid', async () => {
    const classRequestId = new Types.ObjectId();

    studentRequestModel.updateMany.mockResolvedValue(undefined);

    studentRequestModel.find.mockImplementation((query: any) => {
      if (query?._id?.$in) {
        return Promise.resolve([
          {
            classPaymentRequestId: classRequestId,
          },
        ]);
      }

      if (
        query?.classPaymentRequestId &&
        query?.status === StudentPaymentRequestStatus.PAID
      ) {
        return Promise.resolve([
          {
            status: StudentPaymentRequestStatus.PAID,
            finalAmount: 500,
          },
        ]);
      }

      if (query?.classPaymentRequestId && query?.status === undefined) {
        const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return Promise.resolve([
          {
            status: StudentPaymentRequestStatus.PAID,
            finalAmount: 500,
            discountAmount: 0,
            dueDate: pastDate,
          },
          {
            status: StudentPaymentRequestStatus.PENDING,
            finalAmount: 500,
            discountAmount: 0,
            dueDate: pastDate,
          },
        ]);
      }

      return Promise.resolve([]);
    });

    const classRequestDoc: any = {
      amount: 500,
      financialSnapshot: {
        expectedCollectionRate: 1,
        estimatedCost: 100,
        minProfitTarget: 200,
        discountCapPercent: 40,
        capExceedPolicy: 'block',
      },
      save: jest.fn().mockImplementation(async () => undefined),
    };

    classRequestModel.findById.mockResolvedValue(classRequestDoc);
    classRequestModel.findByIdAndUpdate.mockResolvedValue(undefined);

    await service.markAsPaid(
      [new Types.ObjectId().toString()],
      new Types.ObjectId(),
    );

    expect(classRequestDoc.totalCollected).toBe(500);
    expect(classRequestDoc.paidCount).toBe(1);
    expect(classRequestDoc.financialSnapshot.actualCollectionRate).toBeCloseTo(
      0.5,
    );
    expect(classRequestDoc.financialSnapshot.riskLevel).toBe('yellow');
    expect(classRequestDoc.save).toHaveBeenCalled();
  });
});
