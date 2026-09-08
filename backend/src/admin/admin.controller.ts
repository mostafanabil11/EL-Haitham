import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminOverviewService } from './admin-overview.service';
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
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Dashboard counters: students, enrollments, queue, revenue (admin only)' })
  async overview() {
    return this.overviewService.overview();
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
