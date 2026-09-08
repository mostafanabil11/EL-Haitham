import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';
import { CreateAnnouncementDto, UpdateAnnouncementDto, PublishAnnouncementDto } from './dto';

@ApiTags('Admin · Announcements')
@ApiBearerAuth()
@Roles('admin')
@UseInterceptors(AuditInterceptor)
@Controller('admin/announcements')
export class AnnouncementsAdminController {
  constructor(private service: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'All announcements, drafts included (admin only)' })
  async list() {
    return this.service.list();
  }

  @Post()
  @Audit('announcement.create')
  async create(@Body() dto: CreateAnnouncementDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Audit('announcement.update')
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @Audit('announcement.publish')
  async publish(@Param('id') id: string, @Body() dto: PublishAnnouncementDto) {
    return this.service.setPublished(id, dto.isPublished);
  }

  @Delete(':id')
  @Audit('announcement.delete')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
