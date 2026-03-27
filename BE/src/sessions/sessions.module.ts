import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session, SessionSchema } from './schemas/session.schema';
import { ClassEntity, ClassSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: ClassEntity.name, schema: ClassSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
