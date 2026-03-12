import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { SendMessageDto } from './dto/send-message.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ClassEntity } from '../classes/schemas/class.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Message.name) private readonly model: Model<MessageDocument>,
    @InjectModel(ClassEntity.name) private readonly classModel: any,
    private readonly usersService: UsersService,
  ) {}

  async send(user: UserDocument, dto: SendMessageDto) {
    try {
      const doc = new this.model({
        senderId: user._id,
        receiverId: new Types.ObjectId(dto.receiverId),
        content: dto.content,
        isRead: false,
      });
      
      const savedMessage = await doc.save();
      console.log('Message saved successfully:', savedMessage._id);
      return savedMessage;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async list(user: UserDocument, otherUserId?: string) {
    console.log('Chat service list - user:', (user as any)._id, 'otherUserId:', otherUserId);
    
    const query = otherUserId
      ? {
          $or: [
            { senderId: (user as any)._id, receiverId: new Types.ObjectId(otherUserId) },
            { senderId: new Types.ObjectId(otherUserId), receiverId: (user as any)._id },
          ],
        }
      : { $or: [{ senderId: (user as any)._id }, { receiverId: (user as any)._id }] };

    console.log('Query:', JSON.stringify(query, null, 2));

    const messages = await this.model
      .find(query)
      .populate('senderId', 'name role')
      .populate('receiverId', 'name role')
      .sort({ createdAt: otherUserId ? 1 : -1 })
      .exec();

    console.log('Found messages:', messages.length);
    return messages;
  }

  async getConversations(user: UserDocument) {
    // Get all unique conversations for the user
    const userId = new Types.ObjectId(user._id as any);
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
            $cond: [
              { $eq: ['$senderId', userId] },
              '$receiverId',
              '$senderId',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiverId', user._id] },
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
    const userRole = (user as any).role;
    let availableUsers: any[] = [];

    console.log('getAvailableUsers - user:', user.name, 'role:', userRole);

    if (userRole === 'student') {
      // Student can chat with teachers of classes they're enrolled in
      console.log('Finding classes for student:', (user as any)._id);
      const classes = await this.classModel
        .find({ studentIds: user._id })
        .populate('teacherId', '_id name role')
        .exec();

      console.log('Found classes:', classes.length);
      
      availableUsers = classes
        .map((cls: any) => cls.teacherId)
        .filter((teacher: any) => teacher && teacher._id);

      console.log('Available teachers:', availableUsers.length);

      // Remove duplicates
      availableUsers = Array.from(
        new Map(availableUsers.map((u: any) => [u._id.toString(), u])).values()
      );
    } else if (userRole === 'parent') {
      // Parent can chat with teachers of classes their children are enrolled in
      console.log('Parent childEmail:', (user as any).childEmail);
      
      const childUser = await this.usersService.findByEmail((user as any).childEmail);
      console.log('Found child user:', childUser?.name);
      
      if (childUser) {
        console.log('Finding classes for child:', (childUser as any)._id);
        const classes = await this.classModel
          .find({ studentIds: (childUser as any)._id })
          .populate('teacherId', '_id name role')
          .exec();

        console.log('Found classes for child:', classes.length);

        availableUsers = classes
          .map((cls: any) => cls.teacherId)
          .filter((teacher: any) => teacher && teacher._id);

        console.log('Available teachers for parent:', availableUsers.length);

        // Remove duplicates
        availableUsers = Array.from(
          new Map(availableUsers.map((u: any) => [u._id.toString(), u])).values()
        );
      }
    } else if (userRole === 'teacher') {
      // Teacher can chat with students in their classes and their parents
      console.log('Finding classes for teacher:', (user as any)._id);
      const classes = await this.classModel
        .find({ teacherId: user._id })
        .populate('studentIds', '_id name role email')
        .exec();

      console.log('Found classes for teacher:', classes.length);

      const studentMap = new Map<string, any>();
      const parentEmails = new Set<string>();

      // Add students and collect parent emails
      classes.forEach((cls: any) => {
        console.log('Class:', cls.name, 'students:', cls.studentIds.length);
        cls.studentIds.forEach((student: any) => {
          if (student._id) {
            studentMap.set(student._id.toString(), student);
            // Collect parent email if student has one
            if (student.email) {
              parentEmails.add(student.email);
            }
          }
        });
      });

      availableUsers = Array.from(studentMap.values());
      console.log('Available students for teacher:', availableUsers.length);

      // Find parents by their childEmail matching student emails
      if (parentEmails.size > 0) {
        const parents = await this.usersService.findByEmails(Array.from(parentEmails));
        console.log('Found parents:', parents.length);
        availableUsers = [...availableUsers, ...parents];
      }
    }

    console.log('Final availableUsers:', availableUsers.length);
    return availableUsers;
  }

  async markAsRead(user: UserDocument, otherUserId: string) {
    try {
      const result = await this.model.updateMany(
        {
          senderId: new Types.ObjectId(otherUserId),
          receiverId: user._id,
          isRead: false,
        },
        { $set: { isRead: true } },
      );
      console.log(`Marked ${result.modifiedCount} messages as read for user ${user._id} from ${otherUserId}`);
      return result;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }
}
