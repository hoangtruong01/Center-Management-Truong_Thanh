import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UserRole } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { UserDocument } from '../users/schemas/user.schema';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { InvitesService } from '../invites/invites.service';
import { RegisterByInviteDto } from './dto/register-by-invite.dto';
import { ApprovalsService } from '../approvals/approvals.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  branchId?: string;
}

type UserIdentity = UserDocument & {
  id?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly invitesService: InvitesService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  private signTokens(user: UserIdentity) {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshJwtSecret = process.env.REFRESH_JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('Missing required env JWT_SECRET');
    }
    if (!refreshJwtSecret) {
      throw new Error('Missing required env REFRESH_JWT_SECRET');
    }

    const { JWT_EXPIRES_IN = '1h', REFRESH_JWT_EXPIRES_IN = '7d' } =
      process.env;
    const payload: JwtPayload = {
      sub: user._id?.toString?.() || user.id || '',
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: JWT_EXPIRES_IN as JwtSignOptions['expiresIn'],
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshJwtSecret,
      expiresIn: REFRESH_JWT_EXPIRES_IN as JwtSignOptions['expiresIn'],
    });
    return { accessToken, refreshToken };
  }

  private sanitize(user: UserIdentity) {
    const raw = typeof user.toObject === 'function' ? user.toObject() : user;
    const rest = { ...raw } as Record<string, unknown>;
    delete rest.passwordHash;
    return rest;
  }

  async register(dto: RegisterDto) {
    const created = await this.usersService.create({
      ...dto,
      role: UserRole.Student,
    });
    const tokens = this.signTokens(created);
    return { user: this.sanitize(created), ...tokens };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserIdentity | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException('User is not active');
    }
    const tokens = this.signTokens(user);
    const sanitizedUser = this.sanitize(user);
    return {
      user: sanitizedUser,
      ...tokens,
      mustChangePassword: user.mustChangePassword || false,
    };
  }

  async changePassword(userId: string, newPassword: string) {
    const payload: UpdateUserDto = {
      password: newPassword,
      mustChangePassword: false,
    };
    await this.usersService.update(userId, payload);
    return { message: 'Đổi mật khẩu thành công' };
  }

  async registerByInvite(dto: RegisterByInviteDto) {
    const invite = await this.invitesService.useToken(dto.token);
    const createPayload: CreateUserDto = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      role: invite.role as UserRole,
      status: UserStatus.Pending,
      branchId: invite.branchId,
    };
    const created = await this.usersService.create(createPayload);
    await this.approvalsService.createRegisterRequest(created._id?.toString());
    await this.invitesService.markUsed(invite._id.toString());
    return { message: 'Registered. Awaiting admin approval.' };
  }

  async refresh(dto: RefreshDto) {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshJwtSecret = process.env.REFRESH_JWT_SECRET;

    if (!jwtSecret || !refreshJwtSecret) {
      throw new UnauthorizedException('Server auth configuration missing');
    }

    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: refreshJwtSecret,
      }) as JwtPayload;
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('User not found');
      const userIdentity = user as UserIdentity;
      const tokens = this.signTokens(userIdentity);
      return { user: this.sanitize(userIdentity), ...tokens };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Không tiết lộ email có tồn tại hay không vì lý do bảo mật
      return {
        success: true,
        message:
          'Nếu email tồn tại trong hệ thống, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.',
      };
    }

    // TODO: Gửi email reset password trong môi trường production
    // Hiện tại, tạo yêu cầu để admin xử lý
    await this.approvalsService.createPasswordResetRequest(
      user._id?.toString(),
      email,
    );

    return {
      success: true,
      message:
        'Yêu cầu đặt lại mật khẩu đã được gửi. Admin sẽ liên hệ với bạn qua email hoặc số điện thoại đăng ký.',
    };
  }

  async contactAdmin(dto: {
    name: string;
    email: string;
    phone?: string;
    message: string;
    type: string;
  }) {
    // Lưu yêu cầu liên hệ vào hệ thống để admin xem
    await this.approvalsService.createContactRequest(dto);

    return {
      success: true,
      message:
        'Yêu cầu của bạn đã được gửi. Admin sẽ liên hệ lại sớm nhất có thể.',
    };
  }

  async validateLogin(dto: { email: string; role: string; branchId: string }) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      return { valid: true }; // Không tiết lộ email không tồn tại
    }

    const errors: string[] = [];

    // Kiểm tra vai trò
    if (user.role !== dto.role) {
      errors.push(
        `Vai trò không đúng. Tài khoản này có vai trò "${this.translateRole(user.role)}".`,
      );
    }

    // Kiểm tra chi nhánh (admin không cần kiểm tra chi nhánh)
    const userBranchId = user.branchId?.toString?.() || '';
    if (
      user.role !== 'admin' &&
      userBranchId &&
      userBranchId !== dto.branchId
    ) {
      errors.push('Cơ sở không đúng. Vui lòng chọn đúng cơ sở của bạn.');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
      };
    }

    return { valid: true };
  }

  private translateRole(role: string): string {
    const roleMap: Record<string, string> = {
      student: 'Học sinh',
      teacher: 'Giáo viên',
      parent: 'Phụ huynh',
      admin: 'Quản trị viên',
    };
    return roleMap[role] || role;
  }
}
