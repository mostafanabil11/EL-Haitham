import { Controller, Get, Post, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { LearnService } from './learn.service';
import { OptionalAuth } from '@/auth/decorators/optional-auth.decorator';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { RequestUser } from '@/auth/interfaces/request-user.interface';
import { RecordProgressDto } from './dto';
import { ApiResponse } from '@/common/types/api-response';

@ApiTags('Learn')
@Controller('learn')
export class LearnController {
  constructor(private learnService: LearnService) {}

  private userId(user: RequestUser | undefined): Types.ObjectId | null {
    return user?.userId ? new Types.ObjectId(user.userId) : null;
  }

  // Optional auth: an anonymous visitor gets the outline plus any free
  // preview, a subscribed student gets everything. One route serving both is
  // what lets the same page work before and after purchase.
  @OptionalAuth()
  @Get('lectures/:slug')
  @ApiOperation({ summary: 'Lecture with content unlocked according to enrollment' })
  async lecture(
    @Param('slug') slug: string,
    @CurrentUser() user: RequestUser,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    return this.learnService.getLectureForStudent(slug, this.userId(user));
  }

  // Called when playback starts, not when the page renders — so the ticket's
  // short life begins when watching does.
  @OptionalAuth()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('items/:itemId/playback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mint a short-lived, viewer-specific playback ticket' })
  async playback(@Param('itemId') itemId: string, @CurrentUser() user: RequestUser) {
    return this.learnService.getPlaybackTicket(itemId, this.userId(user));
  }

  // The player reports roughly every 15 seconds of playback. The limit is
  // generous enough for that plus seeking, and low enough that a runaway
  // client cannot hammer the database.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('progress')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record playback position' })
  async progress(@CurrentUser() user: RequestUser, @Body() dto: RecordProgressDto) {
    return this.learnService.recordProgress(new Types.ObjectId(user.userId), dto);
  }
}
