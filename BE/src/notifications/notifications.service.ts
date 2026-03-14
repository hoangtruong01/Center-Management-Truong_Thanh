import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../common/enums/role.enum';


@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly model: Model<NotificationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) { }

  async create(dto: CreateNotificationDto) {
    const doc = new this.model({
      ...dto,
      userId: dto.userId ? new Types.ObjectId(dto.userId) : undefined,
    });
    return doc.save();
  }

  listForUser(user: UserDocument) {
    return this.model
      .find({ $or: [{ userId: user._id }, { userId: null }] })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markRead(id: string) {
    const updated = await this.model
      .findByIdAndUpdate(id, { read: true }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Thông báo không tồn tại');
    return updated;
  }

  async markAllRead(user: UserDocument) {
    // Đánh dấu tất cả thông báo của user là đã đọc
    const filter = { $or: [{ userId: user._id }, { userId: null }] };

    await this.model.updateMany(filter, { read: true }).exec();
    return { message: 'Đã đánh dấu tất cả thông báo là đã đọc' };
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Thông báo không tồn tại');
    return { message: 'Xóa thông báo thành công' };
  }

  async removeAll(user: UserDocument) {
    const filter = { $or: [{ userId: user._id }, { userId: null }] };
    await this.model.deleteMany(filter).exec();
    return { message: 'Xóa tất cả thông báo thành công' };
  }

  async notifyAdmins(dto: Omit<CreateNotificationDto, 'userId'>) {
    // 1. Tìm tất cả users có quyền Admin
    const admins = await this.userModel.find({ role: UserRole.Admin }).exec();

    if (!admins || admins.length === 0) {
      return { message: 'Không có Admin nào trong hệ thống để nhận thông báo' };
    }

    // 2. Tạo mảng dữ liệu thông báo cho từng Admin
    const notificationsToInsert = admins.map(admin => ({
      ...dto,
      userId: admin._id,
    }));

    // 3. Insert tất cả vào Database cùng 1 lúc (Dùng insertMany cho nhẹ server)
    await this.model.insertMany(notificationsToInsert);

    return {
      message: 'Gửi thông báo cho Admin thành công',
      count: admins.length
    };
  }
}