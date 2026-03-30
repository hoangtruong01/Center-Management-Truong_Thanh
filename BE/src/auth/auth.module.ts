import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { InvitesModule } from '../invites/invites.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { getJwtConfig } from '../config/jwt.config';

@Module({
  imports: [
    UsersModule,
    InvitesModule,
    ApprovalsModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => getJwtConfig(),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
