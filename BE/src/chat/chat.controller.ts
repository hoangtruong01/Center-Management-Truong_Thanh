import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  send(@CurrentUser() user: UserDocument, @Body() dto: SendMessageDto) {
    return this.chatService.send(user, dto);
  }

  @Get('messages')
  async list(
    @CurrentUser() user: UserDocument,
    @Query('with') withUserId?: string,
  ) {
    return this.chatService.list(user, withUserId);
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: UserDocument) {
    return this.chatService.getConversations(user);
  }

  @Get('available-users')
  getAvailableUsers(@CurrentUser() user: UserDocument) {
    return this.chatService.getAvailableUsers(user);
  }

  @Post('test-message')
  async createTestMessage(
    @CurrentUser() user: UserDocument,
    @Body() body: { receiverId: string; content: string },
  ) {
    return this.chatService.send(user, body);
  }

  @Post('mark-as-read')
  markAsRead(
    @CurrentUser() user: UserDocument,
    @Body() body: { otherUserId: string },
  ) {
    return this.chatService.markAsRead(user, body.otherUserId);
  }
}
