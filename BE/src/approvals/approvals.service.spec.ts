/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApprovalsService } from './approvals.service';

describe('ApprovalsService bulk moderation', () => {
  const approvalModel: any = {};
  const usersService: any = {};
  const classesService: any = {};
  const notificationsService: any = {};

  const service = new ApprovalsService(
    approvalModel,
    usersService,
    classesService,
    notificationsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates success and failure for bulk approve', async () => {
    const approveSpy = jest
      .spyOn(service, 'approveClassTransferRequest')
      .mockImplementation(async (requestId: string) => {
        if (requestId === 'bad-id') {
          throw new Error('request error');
        }
        return {
          requestId,
          status: 'approved',
          classId: 'class-1',
        } as any;
      });

    const result = await service.bulkApproveClassTransferRequests(
      ['ok-1', 'bad-id', 'ok-2', 'ok-1'],
      'admin-1',
    );

    expect(approveSpy).toHaveBeenCalledTimes(3);
    expect(result.total).toBe(3);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.failures[0].requestId).toBe('bad-id');
  });

  it('aggregates success and failure for bulk reject with shared reason', async () => {
    const rejectSpy = jest
      .spyOn(service, 'rejectClassTransferRequest')
      .mockImplementation(async (requestId: string) => {
        if (requestId === 'bad-id') {
          throw new Error('cannot reject');
        }
        return {
          requestId,
          status: 'rejected',
        } as any;
      });

    const result = await service.bulkRejectClassTransferRequests(
      ['ok-1', 'bad-id', 'ok-2'],
      'admin-1',
      'batch reason',
    );

    expect(rejectSpy).toHaveBeenCalledTimes(3);
    expect(result.total).toBe(3);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.failures[0].error).toContain('cannot reject');
  });
});
