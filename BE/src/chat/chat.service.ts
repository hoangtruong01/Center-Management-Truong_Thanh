import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ClassDocument, ClassEntity } from '../classes/schemas/class.schema';

type ChatUserSummary = Pick<UserDocument, '_id' | 'name' | 'role' | 'email'>;

interface TeacherClassView {
  teacherId?: Types.ObjectId | ChatUserSummary;
}

interface TeacherStudentClassView {
  name?: string;
  studentIds: Array<Types.ObjectId | ChatUserSummary>;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private readonly model: Model<MessageDocument>,
    @InjectModel(ClassEntity.name)
    private readonly classModel: Model<ClassDocument>,
    private readonly usersService: UsersService,
  ) {}

  private toObjectId(value: unknown): Types.ObjectId {
    if (value instanceof Types.ObjectId) {
      return value;
    }
    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
    throw new Error('Invalid ObjectId value');
  }

  private isChatUserSummary(value: unknown): value is ChatUserSummary {
    return (
      typeof value === 'object' &&
      value !== null &&
      '_id' in value &&
      'name' in value
    );
  }

  async send(user: UserDocument, dto: SendMessageDto) {
    const doc = new this.model({
      senderId: user._id,
      receiverId: new Types.ObjectId(dto.receiverId),
      content: dto.content,
      isRead: false,
    });

    return doc.save();
  }

  async list(user: UserDocument, otherUserId?: string) {
    const userId = this.toObjectId(user._id);

    const query = otherUserId
      ? {
          $or: [
            { senderId: userId, receiverId: new Types.ObjectId(otherUserId) },
            { senderId: new Types.ObjectId(otherUserId), receiverId: userId },
          ],
        }
      : { $or: [{ senderId: userId }, { receiverId: userId }] };

    const messages = await this.model
      .find(query)
      .populate('senderId', 'name role')
      .populate('receiverId', 'name role')
      .sort({ createdAt: otherUserId ? 1 : -1 })
      .exec();

    return messages;
  }

  async getConversations(user: UserDocument) {
    // Get all unique conversations for the user
    const userId = this.toObjectId(user._id);
    const conversations = await this.model.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$senderId', userId] }, '$receiverId', '$senderId'],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', userId] },
                    { $eq: ['$isRead', false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'otherUser',
        },
      },
      {
        $unwind: '$otherUser',
      },
      {
        $project: {
          otherUser: {
            _id: 1,
            name: 1,
            role: 1,
          },
          lastMessage: 1,
          unreadCount: 1,
        },
      },
      {
        $sort: { 'lastMessage.createdAt': -1 },
      },
    ]);

    return conversations;
  }

  async getAvailableUsers(user: UserDocument) {
    const userRole = user.role;
    let availableUsers: ChatUserSummary[] = [];

    if (userRole === 'student') {
      // Student can chat with teachers of classes they're enrolled in
      const classes = (await this.classModel
        .find({ studentIds: user._id })
        .populate('teacherId', '_id name role')
        .exec()) as TeacherClassView[];

      availableUsers = classes
        .map((cls) => cls.teacherId)
        .filter(this.isChatUserSummary);

      // Remove duplicates
      availableUsers = Array.from(
        new Map(availableUsers.map((u) => [u._id.toString(), u])).values(),
      );
    } else if (userRole === 'parent') {
      // Parent can chat with teachers of classes their children are enrolled in
      const childUser = user.childEmail
        ? await this.usersService.findByEmail(user.childEmail)
        : null;

      if (childUser) {
        const classes = (await this.classModel
          .find({ studentIds: childUser._id })
          .populate('teacherId', '_id name role')
          .exec()) as TeacherClassView[];

        availableUsers = classes
          .map((cls) => cls.teacherId)
          .filter(this.isChatUserSummary);

        // Remove duplicates
        availableUsers = Array.from(
          new Map(availableUsers.map((u) => [u._id.toString(), u])).values(),
        );
      }
    } else if (userRole === 'teacher') {
      // Teacher can chat with students in their classes and their parents
      const classes = (await this.classModel
        .find({ teacherId: user._id })
        .populate('studentIds', '_id name role email')
        .exec()) as TeacherStudentClassView[];

      const studentMap = new Map<string, ChatUserSummary>();
      const parentEmails = new Set<string>();

      // Add students and collect parent emails
      classes.forEach((cls) => {
        cls.studentIds.forEach((student) => {
          if (this.isChatUserSummary(student)) {
            studentMap.set(student._id.toString(), student);
            // Collect parent email if student has one
            if (student.email) {
              parentEmails.add(student.email);
            }
          }
        });
      });

      availableUsers = Array.from(studentMap.values());

      // Find parents by their childEmail matching student emails
      if (parentEmails.size > 0) {
        const parents = await this.usersService.findByEmails(
          Array.from(parentEmails),
        );
        availableUsers = [...availableUsers, ...parents];
      }
    }

    return availableUsers;
  }

  async markAsRead(user: UserDocument, otherUserId: string) {
    return this.model.updateMany(
      {
        senderId: new Types.ObjectId(otherUserId),
        receiverId: user._id,
        isRead: false,
      },
      { $set: { isRead: true } },
    );
  }
}
