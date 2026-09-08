import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LecturesService } from './lectures.service';
import { TermsService } from './terms.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';
import {
  CreateTermDto,
  UpdateTermDto,
  CreateLectureDto,
  UpdateLectureDto,
  PublishLectureDto,
  CreateLectureItemDto,
  UpdateLectureItemDto,
  ReorderDto,
  CatalogQueryDto,
} from './dto';
import { ApiResponse } from '@/common/types/api-response';

@ApiTags('Admin · Content')
@ApiBearerAuth()
@Roles('admin')
@UseInterceptors(AuditInterceptor)
@Controller('admin/content')
export class ContentAdminController {
  constructor(
    private lecturesService: LecturesService,
    private termsService: TermsService,
  ) {}

  // --- Terms ---

  @Get('terms')
  @ApiOperation({ summary: 'List terms, including archived ones' })
  async listTerms(@Query('includeArchived') includeArchived?: string) {
    return this.termsService.findAll(includeArchived === 'true');
  }

  @Post('terms')
  @Audit('term.create')
  async createTerm(@Body() dto: CreateTermDto) {
    return this.termsService.create(dto);
  }

  @Patch('terms/:id')
  @Audit('term.update')
  async updateTerm(@Param('id') id: string, @Body() dto: UpdateTermDto) {
    return this.termsService.update(id, dto);
  }

  @Post('terms/reorder')
  @HttpCode(200)
  @Audit('term.reorder')
  async reorderTerms(@Body() dto: ReorderDto) {
    return this.termsService.reorder(dto);
  }

  @Delete('terms/:id')
  @Audit('term.delete')
  async removeTerm(@Param('id') id: string) {
    return this.termsService.remove(id);
  }

  // Rolls the academic year over: archives every term and lecture from the
  // named year in one move.
  @Post('terms/archive-year/:academicYear(*)')
  @HttpCode(200)
  @Audit('term.archive_year')
  async archiveYear(@Param('academicYear') academicYear: string) {
    return this.termsService.archiveAcademicYear(academicYear);
  }

  // --- Lectures ---

  @Get('lectures')
  @ApiOperation({ summary: 'List lectures for the admin panel' })
  async listLectures(@Query() query: CatalogQueryDto, @Query('includeArchived') includeArchived?: string) {
    return this.lecturesService.findAllAdmin({ ...query, includeArchived: includeArchived === 'true' });
  }

  @Get('lectures/:id')
  async getLecture(@Param('id') id: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.lecturesService.findOneAdmin(id);
  }

  @Post('lectures')
  @Audit('lecture.create')
  async createLecture(@Body() dto: CreateLectureDto) {
    return this.lecturesService.create(dto);
  }

  @Patch('lectures/:id')
  @Audit('lecture.update')
  async updateLecture(@Param('id') id: string, @Body() dto: UpdateLectureDto) {
    return this.lecturesService.update(id, dto);
  }

  @Post('lectures/:id/publish')
  @HttpCode(200)
  @Audit('lecture.publish')
  async publishLecture(@Param('id') id: string, @Body() dto: PublishLectureDto) {
    return this.lecturesService.setPublished(id, dto.isPublished);
  }

  @Post('lectures/reorder')
  @HttpCode(200)
  @Audit('lecture.reorder')
  async reorderLectures(@Body() dto: ReorderDto) {
    return this.lecturesService.reorder(dto);
  }

  @Delete('lectures/:id')
  @Audit('lecture.delete')
  async removeLecture(@Param('id') id: string) {
    return this.lecturesService.remove(id);
  }

  // --- Lecture items ---

  @Post('lectures/:id/items')
  @Audit('lecture_item.create')
  async addItem(@Param('id') id: string, @Body() dto: CreateLectureItemDto) {
    return this.lecturesService.addItem(id, dto);
  }

  @Patch('items/:itemId')
  @Audit('lecture_item.update')
  async updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateLectureItemDto) {
    return this.lecturesService.updateItem(itemId, dto);
  }

  @Delete('items/:itemId')
  @Audit('lecture_item.delete')
  async removeItem(@Param('itemId') itemId: string) {
    return this.lecturesService.removeItem(itemId);
  }

  @Post('items/reorder')
  @HttpCode(200)
  @Audit('lecture_item.reorder')
  async reorderItems(@Body() dto: ReorderDto) {
    return this.lecturesService.reorderItems(dto);
  }
}
