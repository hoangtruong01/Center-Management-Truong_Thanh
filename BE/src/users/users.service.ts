import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '../common/enums/role.enum';
import { SUBJECT_LIST } from '../common/enums/subject.enum';

interface FindAllFilters {
  role?: string;
  status?: string;
  branchId?: string;
  subject?: string; // Lọc giáo viên theo môn dạy
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  // Sinh mã số tự động cho học sinh, giáo viên, phụ huynh
  private async generateUserCode(
    role: UserRole,
    childEmail?: string,
  ): Promise<string> {
    if (role === UserRole.Student) {
      // Tìm mã số học sinh cao nhất hiện có
      const lastStudent = await this.userModel
        .findOne({
          role: UserRole.Student,
          studentCode: { $exists: true, $ne: null },
        })
        .sort({ studentCode: -1 })
        .select('studentCode')
        .lean();

      let nextNumber = 1;
      if (lastStudent && lastStudent.studentCode) {
        const currentNumber = parseInt(
          lastStudent.studentCode.replace('HS', ''),
          10,
        );
        nextNumber = currentNumber + 1;
      }
      return `HS${nextNumber.toString().padStart(4, '0')}`;
    }

    if (role === UserRole.Teacher) {
      // Tìm mã số giáo viên cao nhất hiện có
      const lastTeacher = await this.userModel
        .findOne({
          role: UserRole.Teacher,
          teacherCode: { $exists: true, $ne: null },
        })
        .sort({ teacherCode: -1 })
        .select('teacherCode')
        .lean();

      let nextNumber = 1;
      if (lastTeacher && lastTeacher.teacherCode) {
        const currentNumber = parseInt(
          lastTeacher.teacherCode.replace('GV', ''),
          10,
        );
        nextNumber = currentNumber + 1;
      }
      return `GV${nextNumber.toString().padStart(4, '0')}`;
    }

    if (role === UserRole.Parent && childEmail) {
      // Tìm học sinh theo email để lấy mã
      const student = await this.userModel.findOne({
        email: childEmail.toLowerCase().trim(),
        role: UserRole.Student,
      });
      if (student && student.studentCode) {
        // Lấy số từ mã học sinh (HS0001 -> 0001)
        const studentNumber = student.studentCode.replace('HS', '');
        return `PH${studentNumber}`;
      }
      // Nếu không tìm thấy học sinh, tìm mã phụ huynh cao nhất
      const lastParent = await this.userModel
        .findOne({
          role: UserRole.Parent,
          parentCode: { $exists: true, $ne: null },
        })
        .sort({ parentCode: -1 })
        .select('parentCode')
        .lean();

      let nextNumber = 1;
      if (lastParent && lastParent.parentCode) {
        const currentNumber = parseInt(
          lastParent.parentCode.replace('PH', ''),
          10,
        );
        nextNumber = currentNumber + 1;
      }
      return `PH${nextNumber.toString().padStart(4, '0')}`;
    }

    return '';
  }

  async create(dto: CreateUserDto): Promise<User> {
    const or: any[] = [{ email: dto.email }];
    if (dto.phone) {
      or.push({ phone: dto.phone });
    }
    const exists = await this.userModel.findOne({ $or: or }).lean();
    if (exists) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Tạo mã số theo role
    const userCode = await this.generateUserCode(
      dto.role || UserRole.Student,
      dto.childEmail,
    );

    // Tính ngày hết hạn (5 năm sau)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 5);

    const userData: any = { ...dto, passwordHash, expiresAt };

    // Gán mã số theo role
    if (dto.role === UserRole.Student) {
      userData.studentCode = userCode;
    } else if (dto.role === UserRole.Teacher) {
      userData.teacherCode = userCode;
    } else if (dto.role === UserRole.Parent) {
      userData.parentCode = userCode;
    }

    const created = new this.userModel(userData);
    return created.save();
  }

  findAll(filters?: FindAllFilters): Promise<User[]> {
    const query: any = {};

    if (filters?.role) {
      query.role = filters.role;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.branchId) {
      query.branchId = filters.branchId;
    }
    // Lọc giáo viên theo môn dạy
    if (filters?.subject) {
      query.subjects = { $in: [filters.subject] };
    }

    return this.userModel.find(query).select('-passwordHash').exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel
      .findById(id)
      .select('-passwordHash')
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findParentsForStudent(student: {
    studentId: string;
    email?: string;
    parentPhone?: string;
  }): Promise<User[]> {
    const orConditions: any[] = [{ childrenIds: { $in: [student.studentId] } }];

    if (student.email) {
      orConditions.push({ childEmail: student.email.toLowerCase().trim() });
    }

    if (student.parentPhone) {
      orConditions.push({ phone: student.parentPhone });
    }

    if (orConditions.length === 0) return [];

    return this.userModel
      .find({
        role: UserRole.Parent,
        $or: orConditions,
      })
      .select('-passwordHash')
      .exec();
  }

  async findByEmails(emails: string[]): Promise<UserDocument[]> {
    return this.userModel.find({ childEmail: { $in: emails } }).exec();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.password) {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      (dto as any).passwordHash = passwordHash;
      delete (dto as any).password;
    }
    const updated = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true })
      .select('-passwordHash')
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const res = await this.userModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('User not found');
  }

  // Xóa các tài khoản đã hết hạn (5 năm)
  async removeExpiredAccounts(): Promise<number> {
    const now = new Date();
    const result = await this.userModel.deleteMany({
      expiresAt: { $lte: now },
      role: { $in: [UserRole.Student, UserRole.Parent] }, // Chỉ xóa học sinh và phụ huynh
    });
    return result.deletedCount;
  }

  // Lấy danh sách giáo viên theo môn học
  async findTeachersBySubject(subject: string): Promise<User[]> {
    return this.userModel
      .find({
        role: UserRole.Teacher,
        subjects: { $in: [subject] },
      })
      .select('-passwordHash')
      .exec();
  }

  // Lấy danh sách tất cả môn học có trong hệ thống
  getAvailableSubjects(): string[] {
    return SUBJECT_LIST;
  }

  // Lấy thống kê giáo viên theo môn học
  async getTeacherStatsBySubject(): Promise<
    Array<{ subject: string; count: number }>
  > {
    const stats = await this.userModel.aggregate([
      { $match: { role: UserRole.Teacher } },
      { $unwind: '$subjects' },
      {
        $group: {
          _id: '$subjects',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          subject: '$_id',
          count: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
    ]);

    return stats;
  }

  // Tìm học sinh theo email (để phụ huynh liên kết)
  async findStudentByEmail(email: string): Promise<User | null> {
    return this.userModel
      .findOne({
        email: email.toLowerCase().trim(),
        role: UserRole.Student,
      })
      .select('-passwordHash')
      .exec();
  }

  // Lấy thông tin con của phụ huynh (dựa trên childEmail hoặc các tiêu chí khác)
  async getParentChildren(parentId: string): Promise<User[]> {
    const parent = await this.userModel.findById(parentId).exec();
    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    if (parent.role !== UserRole.Parent) {
      return [];
    }

    const children: User[] = [];
    const foundIds = new Set<string>();

    // Cách 1: Tìm theo childEmail của phụ huynh
    if (parent.childEmail) {
      const child = await this.userModel
        .findOne({
          email: parent.childEmail.toLowerCase().trim(),
          role: UserRole.Student,
        })
        .select('-passwordHash')
        .exec();

      if (child) {
        children.push(child);
        foundIds.add(child._id.toString());
      }
    }

    // Cách 2: Tìm học sinh có parentPhone trùng với phone của phụ huynh
    if (parent.phone) {
      const byPhone = await this.userModel
        .find({
          role: UserRole.Student,
          parentPhone: parent.phone,
        })
        .select('-passwordHash')
        .exec();

      for (const child of byPhone) {
        if (!foundIds.has(child._id.toString())) {
          children.push(child);
          foundIds.add(child._id.toString());
        }
      }
    }

    // Cách 3: Tìm học sinh có parentName trùng với name của phụ huynh
    if (parent.name) {
      const byName = await this.userModel
        .find({
          role: UserRole.Student,
          parentName: { $regex: new RegExp(parent.name, 'i') },
        })
        .select('-passwordHash')
        .exec();

      for (const child of byName) {
        if (!foundIds.has(child._id.toString())) {
          children.push(child);
          foundIds.add(child._id.toString());
        }
      }
    }

    // Cách 4: Tìm theo parentCode - nếu mã phụ huynh trùng với số trong mã học sinh
    if (parent.parentCode) {
      const parentNumber = parent.parentCode.replace('PH', '');
      const studentCode = `HS${parentNumber}`;
      const byCode = await this.userModel
        .findOne({
          role: UserRole.Student,
          studentCode: studentCode,
        })
        .select('-passwordHash')
        .exec();

      if (byCode && !foundIds.has(byCode._id.toString())) {
        children.push(byCode);
        foundIds.add(byCode._id.toString());
      }
    }

    return children;
  }

  // Tìm child bằng email cho parent
  async findChildByEmail(
    email: string,
    currentUser: UserDocument,
  ): Promise<User | null> {
    // Nếu là parent, chỉ cho phép tìm nếu email trùng với childEmail của họ
    if (currentUser.role === UserRole.Parent) {
      if (currentUser.childEmail?.toLowerCase() !== email.toLowerCase()) {
        return null;
      }
    }

    return this.userModel
      .findOne({
        email: email.toLowerCase().trim(),
        role: UserRole.Student,
      })
      .select('-passwordHash')
      .exec();
  }
}
