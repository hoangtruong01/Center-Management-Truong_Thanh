/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { PaymentMethod, PaymentStatus } from './schemas/payment.schema';

describe('PaymentsService.findByUser', () => {
  const paymentModel: any = {
    find: jest.fn(),
    findById: jest.fn(),
  };

  const transactionModel: any = jest.fn();

  const userModel: any = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };

  const branchModel: any = {};

  const paymentRequestsService: any = {
    markAsPaid: jest.fn(),
    validateRequestsForPayment: jest.fn(),
  };

  const gatewayFactory: any = {
    getByMethod: jest.fn(),
  };

  const emitMock = jest.fn();
  const toMock = jest.fn().mockReturnValue({ emit: emitMock });
  const chatGateway: any = {
    server: {
      to: toMock,
    },
  };

  const service = new PaymentsService(
    paymentModel,
    transactionModel,
    userModel,
    branchModel,
    paymentRequestsService,
    gatewayFactory,
    chatGateway,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    transactionModel.mockImplementation(() => ({
      save: jest.fn().mockImplementation(async () => undefined),
    }));
  });

  it('returns parent payment history by paidBy and child studentId', async () => {
    const parentId = new Types.ObjectId().toString();
    const childId = new Types.ObjectId().toString();

    userModel.findById.mockReturnValue({
      lean: jest.fn().mockImplementation(async () => ({
        _id: parentId,
        childEmail: 'child@example.com',
        childrenIds: [],
      })),
    });

    userModel.findOne.mockReturnValue({
      lean: jest.fn().mockImplementation(async () => ({
        _id: new Types.ObjectId(childId),
        email: 'child@example.com',
      })),
    });

    const sortedPayments = [{ _id: 'p1' }];
    const sortMock = jest.fn().mockImplementation(async () => sortedPayments);
    paymentModel.find.mockReturnValue({ sort: sortMock });

    const result = await service.findByUser(parentId, 'parent');

    expect(result).toEqual(sortedPayments);
    expect(userModel.findById).toHaveBeenCalledWith(parentId);
    expect(userModel.findOne).toHaveBeenCalledWith({
      email: 'child@example.com',
    });
    expect(paymentModel.find).toHaveBeenCalledTimes(1);

    const query = paymentModel.find.mock.calls[0][0];
    expect(Array.isArray(query.$or)).toBe(true);
    expect(query.$or.length).toBe(2);

    expect(query.$or[0].paidBy.toString()).toBe(parentId);

    const studentIds = query.$or[1].studentId.$in as Types.ObjectId[];
    expect(studentIds).toHaveLength(1);
    expect(studentIds[0].toString()).toBe(childId);

    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('falls back to paidBy-only query when parent has no linked child', async () => {
    const parentId = new Types.ObjectId().toString();

    userModel.findById.mockReturnValue({
      lean: jest.fn().mockImplementation(async () => ({
        _id: parentId,
        childEmail: undefined,
        childrenIds: [],
      })),
    });

    const sortMock = jest.fn().mockImplementation(async () => []);
    paymentModel.find.mockReturnValue({ sort: sortMock });

    await service.findByUser(parentId, 'parent');

    const query = paymentModel.find.mock.calls[0][0];
    expect(query.$or).toHaveLength(1);
    expect(query.$or[0].paidBy.toString()).toBe(parentId);
  });

  it('keeps student behavior unchanged', async () => {
    const studentId = new Types.ObjectId().toString();

    const sortMock = jest
      .fn()
      .mockImplementation(async () => [{ _id: 'p-student' }]);
    paymentModel.find.mockReturnValue({ sort: sortMock });

    const result = await service.findByUser(studentId, 'student');

    expect(result).toEqual([{ _id: 'p-student' }]);
    expect(paymentModel.find).toHaveBeenCalledWith({
      studentId: new Types.ObjectId(studentId),
    });
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('emits realtime payment update for student and payer after successful callback', async () => {
    const paymentId = new Types.ObjectId();
    const studentId = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    const requestId = new Types.ObjectId();

    const paymentDoc: any = {
      _id: paymentId,
      requestIds: [requestId],
      paidBy: parentId,
      studentId,
      method: PaymentMethod.FAKE,
      status: PaymentStatus.PENDING,
      save: jest.fn().mockImplementation(async () => undefined),
    };

    paymentModel.findById.mockImplementation(async () => paymentDoc);
    paymentRequestsService.markAsPaid.mockImplementation(async () => undefined);

    const result = await service.handleFakePayosCallback(
      paymentId.toString(),
      'SUCCESS',
    );

    expect(result.success).toBe(true);
    expect(paymentRequestsService.markAsPaid).toHaveBeenCalledWith(
      [requestId.toString()],
      paymentId,
    );

    expect(toMock).toHaveBeenCalledWith(`user_${studentId.toString()}`);
    expect(toMock).toHaveBeenCalledWith(`user_${parentId.toString()}`);

    expect(emitMock).toHaveBeenCalledWith(
      'paymentStatusUpdated',
      expect.objectContaining({
        paymentId: paymentId.toString(),
        status: PaymentStatus.SUCCESS,
        studentId: studentId.toString(),
        paidBy: parentId.toString(),
      }),
    );
  });
});
