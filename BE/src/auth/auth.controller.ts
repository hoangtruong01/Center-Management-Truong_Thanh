import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterByInviteDto } from './dto/register-by-invite.dto';
import { ForceChangePasswordDto } from './dto/change-password.dto';
import {
  ForgotPasswordDto,
  ContactAdminDto,
  ValidateLoginDto,
} from './dto/forgot-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { RequestWithUser } from '../common/interfaces/request-with-user';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng ký tài khoản (mặc định role student)' })
  @ApiBody({ type: RegisterDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/by-invite')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng ký qua invite token (status=PENDING)' })
  @ApiBody({ type: RegisterByInviteDto })
  registerByInvite(@Body() dto: RegisterByInviteDto) {
    return this.authService.registerByInvite(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Đăng nhập, trả về accessToken + refreshToken' })
  @ApiBody({ type: LoginDto })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Lấy accessToken mới từ refreshToken' })
  @ApiBearerAuth()
  @ApiBody({ type: RefreshDto })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu (bắt buộc khi đăng nhập lần đầu)' })
  @ApiBody({ type: ForceChangePasswordDto })
  changePassword(
    @Request() req: RequestWithUser,
    @Body() dto: ForceChangePasswordDto,
  ) {
    const userId = req.user._id?.toString() || req.user.id;
    return this.authService.changePassword(userId, dto.newPassword);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu' })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('contact-admin')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi yêu cầu liên hệ admin' })
  @ApiBody({ type: ContactAdminDto })
  contactAdmin(@Body() dto: ContactAdminDto) {
    return this.authService.contactAdmin(dto);
  }

  @Post('validate-login')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Kiểm tra vai trò và chi nhánh trước khi đăng nhập',
  })
  @ApiBody({ type: ValidateLoginDto })
  validateLogin(@Body() dto: ValidateLoginDto) {
    return this.authService.validateLogin(dto);
  }
}
