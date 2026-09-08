import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { AccessCodesService } from './access-codes.service';
import { EnrollmentsService } from './enrollments.service';
import { PurchaseRequestsService } from './purchase-requests.service';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { RequestUser } from '@/auth/interfaces/request-user.interface';
import { RedeemCodeDto, CreatePurchaseRequestDto } from './dto';

// Evaluated at class-definition time, so it reads process.env directly rather
// than ConfigService — same reasoning as AUTH_THROTTLE in auth.controller.ts.
// Configurable because a fixed limit makes the concurrency test unrunnable:
// eight simultaneous redemptions from one machine are one IP, and the limiter
// would refuse seven of them before the race it is meant to prove ever
// reached the database.
const REDEEM_THROTTLE = {
  default: {
    limit: Number(process.env.REDEEM_THROTTLE_LIMIT ?? 5),
    ttl: 60000,
  },
};

// Student-facing commerce. Everything here requires an account: a code binds
// permanently to the student who redeems it, which is what makes "who owns
// this lecture" answerable at all.
@ApiTags('Commerce')
@ApiBearerAuth()
@Controller()
export class CommerceController {
  constructor(
    private accessCodesService: AccessCodesService,
    private enrollmentsService: EnrollmentsService,
    private purchaseRequestsService: PurchaseRequestsService,
  ) {}

  // A 12-character code from a 31-character alphabet is not guessable, so this
  // limit is not really about brute force. It caps a script working through a
  // list of *leaked* codes, which is the realistic attack: someone posts a
  // batch photo in a group chat and a dozen people race to burn them.
  @Throttle(REDEEM_THROTTLE)
  @Post('access-codes/redeem')
  @HttpCode(200)
  @ApiOperation({ summary: 'Redeem an access code and unlock its lectures' })
  async redeem(@CurrentUser() user: RequestUser, @Body() dto: RedeemCodeDto) {
    return this.accessCodesService.redeem(dto.code, new Types.ObjectId(user.userId));
  }

  @Get('enrollments/mine')
  @ApiOperation({ summary: 'Lectures this student can watch' })
  async myEnrollments(@CurrentUser() user: RequestUser) {
    return this.enrollmentsService.listForUser(new Types.ObjectId(user.userId));
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('purchase-requests')
  @ApiOperation({ summary: 'Start a purchase and get a prefilled WhatsApp link' })
  async createRequest(@CurrentUser() user: RequestUser, @Body() dto: CreatePurchaseRequestDto) {
    return this.purchaseRequestsService.create(new Types.ObjectId(user.userId), dto);
  }

  @Get('purchase-requests/mine')
  @ApiOperation({ summary: "This student's purchase requests" })
  async myRequests(@CurrentUser() user: RequestUser) {
    return this.purchaseRequestsService.listMine(new Types.ObjectId(user.userId));
  }
}
