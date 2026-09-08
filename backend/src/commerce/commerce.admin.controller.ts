import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AccessCodesService } from './access-codes.service';
import { EnrollmentsService } from './enrollments.service';
import { PurchaseRequestsService } from './purchase-requests.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';
import {
  GenerateCodesDto,
  ConfirmPaymentDto,
  GrantEnrollmentDto,
  ExtendEnrollmentDto,
  SetEnrollmentActiveDto,
} from './dto';
import { ApiResponse } from '@/common/types/api-response';

@ApiTags('Admin · Commerce')
@ApiBearerAuth()
@Roles('admin')
@UseInterceptors(AuditInterceptor)
@Controller('admin')
export class CommerceAdminController {
  constructor(
    private accessCodesService: AccessCodesService,
    private enrollmentsService: EnrollmentsService,
    private purchaseRequestsService: PurchaseRequestsService,
  ) {}

  // --- Purchase requests: the teacher's to-do list ---

  @Get('purchase-requests')
  @ApiOperation({ summary: 'Purchase request queue, filterable by status' })
  async listRequests(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.purchaseRequestsService.list({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // One click: marks paid AND mints the code, returning a message ready to
  // paste back into the same WhatsApp conversation.
  @Post('purchase-requests/:id/confirm')
  @HttpCode(200)
  @Audit('purchase_request.confirm')
  @ApiOperation({ summary: 'Confirm payment and issue the access code' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
  ): Promise<ApiResponse<unknown>> {
    return this.purchaseRequestsService.confirmPayment(id, dto.adminNote);
  }

  @Post('purchase-requests/:id/cancel')
  @HttpCode(200)
  @Audit('purchase_request.cancel')
  async cancelRequest(@Param('id') id: string) {
    return this.purchaseRequestsService.cancel(id);
  }

  // --- Access codes ---

  @Get('access-codes')
  @ApiOperation({ summary: 'List codes, filterable by status / batch / lecture' })
  async listCodes(
    @Query('status') status?: string,
    @Query('batchId') batchId?: string,
    @Query('lectureId') lectureId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.accessCodesService.list({
      status,
      batchId,
      lectureId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('access-codes/generate')
  @Audit('access_code.generate')
  @ApiOperation({ summary: 'Generate a batch of codes for a lecture or bundle' })
  async generate(@Body() dto: GenerateCodesDto): Promise<ApiResponse<unknown>> {
    return this.accessCodesService.generate(dto);
  }

  @Post('access-codes/:id/revoke')
  @HttpCode(200)
  @Audit('access_code.revoke')
  async revoke(@Param('id') id: string) {
    return this.accessCodesService.revoke(id);
  }

  @Post('access-codes/batch/:batchId/revoke')
  @HttpCode(200)
  @Audit('access_code.revoke_batch')
  @ApiOperation({ summary: 'Revoke every unused code in a batch' })
  async revokeBatch(@Param('batchId') batchId: string) {
    return this.accessCodesService.revokeBatch(batchId);
  }

  // --- Enrollments ---

  @Get('enrollments/lecture/:lectureId')
  @ApiOperation({ summary: 'Who has access to a lecture' })
  async listForLecture(@Param('lectureId') lectureId: string) {
    return this.enrollmentsService.listForLecture(lectureId);
  }

  @Post('enrollments/grant')
  @Audit('enrollment.grant')
  @ApiOperation({ summary: 'Grant access without a code (scholarship, support case)' })
  async grant(@Body() dto: GrantEnrollmentDto) {
    return this.enrollmentsService.grantManual(dto.userId, dto.lectureId);
  }

  @Patch('enrollments/:id/active')
  @Audit('enrollment.set_active')
  async setActive(@Param('id') id: string, @Body() dto: SetEnrollmentActiveDto) {
    return this.enrollmentsService.setActive(id, dto.isActive);
  }

  @Patch('enrollments/:id/extend')
  @Audit('enrollment.extend')
  async extend(@Param('id') id: string, @Body() dto: ExtendEnrollmentDto) {
    return this.enrollmentsService.extend(id, dto.days);
  }
}
