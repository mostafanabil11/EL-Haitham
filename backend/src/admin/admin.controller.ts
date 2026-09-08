import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminOverviewService } from './admin-overview.service';
import { AdminReportsService } from './admin-reports.service';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';
import { Roles } from '@/common/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private overviewService: AdminOverviewService,
    private reportsService: AdminReportsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Dashboard counters: students, enrollments, queue, revenue (admin only)' })
  async overview() {
    return this.overviewService.overview();
  }

  // Parent reports. Read-only and derived — nothing here writes, so the
  // teacher can regenerate a month as often as he likes.
  @Get('reports')
  @ApiOperation({ summary: 'Monthly progress reports, one per student (admin only)' })
  async reports(
    @Query('month') month?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.monthly({
      month,
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('students/:id/report')
  @ApiOperation({ summary: "One student's progress report for a month (admin only)" })
  async studentReport(@Param('id') id: string, @Query('month') month?: string) {
    return this.reportsService.forStudent(id, month);
  }

  @Get('students')
  @ApiOperation({ summary: 'List students, searchable by phone/parent phone/name/email (admin only)' })
  async listStudents(@Query() query: AdminCustomerQueryDto) {
    return this.adminService.listStudents(query);
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'One student: enrollments, codes, requests, progress (admin only)' })
  async getStudent(@Param('id') id: string) {
    return this.adminService.getStudent(id);
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'List admin mutation history (admin only)' })
  async listAuditLog(@Query() query: AdminAuditQueryDto) {
    return this.adminService.listAuditLog(query);
  }
}
