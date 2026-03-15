import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Incident,
  IncidentDocument,
  IncidentStatus,
} from './schemas/incident.schema';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

interface FindAllFilters {
  status?: IncidentStatus;
  type?: string;
  reporterId?: string;
}

@Injectable()
export class IncidentsService {
  constructor(
    @InjectModel(Incident.name)
    private readonly incidentModel: Model<IncidentDocument>,
    private readonly notificationsService: NotificationsService,
  ) { }

  async create(dto: CreateIncidentDto, user: UserDocument): Promise<Incident> {
    const incident = new this.incidentModel({
      ...dto,
      reporterId: user._id,
      reporterName: user.name,
      reporterEmail: user.email,
      reporterPhone: (user as any).phone || '',
      reporterRole: user.role,
    });
    return incident.save();
  }

  async findAll(filters?: FindAllFilters): Promise<Incident[]> {
    const query: any = {};

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.reporterId) {
      query.reporterId = new Types.ObjectId(filters.reporterId);
    }

    return this.incidentModel
      .find(query)
      .populate('reporterId', 'name email role')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<Incident[]> {
    return this.incidentModel
      .find({ reporterId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.incidentModel
      .findById(id)
      .populate('reporterId', 'name email role')
      .populate('resolvedBy', 'name email')
      .exec();

    if (!incident) {
      throw new NotFoundException('Không tìm thấy sự cố');
    }

    return incident;
  }

  async update(
    id: string,
    dto: UpdateIncidentDto,
    adminId?: string,
  ): Promise<Incident> {
    const updateData: any = { ...dto };

    // Nếu status thay đổi thành resolved, cập nhật resolvedBy và resolvedAt
    if (dto.status === IncidentStatus.Resolved && adminId) {
      updateData.resolvedBy = new Types.ObjectId(adminId);
      updateData.resolvedAt = new Date();
    }

    const updated = await this.incidentModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('reporterId', 'name email role')
      .populate('resolvedBy', 'name email')
      .exec();

    if (!updated) {
      throw new NotFoundException('Không tìm thấy sự cố');
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.incidentModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy sự cố');
    }
  }

  // Thống kê sự cố
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    rejected: number;
    byType: Array<{ type: string; count: number }>;
    byPlatform: Array<{ platform: string; count: number }>;
  }> {
    const [statusStats, typeStats, platformStats] = await Promise.all([
      this.incidentModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      this.incidentModel.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      this.incidentModel.aggregate([
        {
          $group: {
            _id: '$platform',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusMap = statusStats.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total:
        (statusMap.pending || 0) +
        (statusMap.in_progress || 0) +
        (statusMap.resolved || 0) +
        (statusMap.rejected || 0),
      pending: statusMap.pending || 0,
      inProgress: statusMap.in_progress || 0,
      resolved: statusMap.resolved || 0,
      rejected: statusMap.rejected || 0,
      byType: typeStats.map((item) => ({ type: item._id, count: item.count })),
      byPlatform: platformStats.map((item) => ({
        platform: item._id,
        count: item.count,
      })),
    };
  }
}
