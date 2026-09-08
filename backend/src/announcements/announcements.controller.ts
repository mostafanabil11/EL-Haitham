import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AnnouncementsService } from './announcements.service';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { RequestUser } from '@/auth/interfaces/request-user.interface';

// Authenticated by the global guard, like every other student route — there is
// no @Public() here, because an announcement addressed to "students of the
// third secondary" is only meaningful once we know who is asking.
@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private service: AnnouncementsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Announcements addressed to the signed-in student' })
  async mine(@CurrentUser() user: RequestUser) {
    return this.service.forStudent(new Types.ObjectId(user.userId));
  }
}
