import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LecturesService } from './lectures.service';
import { TermsService } from './terms.service';
import { Public } from '@/auth/decorators/public.decorator';
import { CatalogQueryDto } from './dto';
import { ApiResponse } from '@/common/types/api-response';

// The public catalogue. Deliberately readable with no account at all.
//
// The incumbent shows a logged-out visitor "يجب تسجيل الدخول أولاً لمشاهدة
// الكورسات" while serving its whole catalogue — names, prices, subscriber
// counts — from an unauthenticated API endpoint. That combination hides the
// product from the person deciding whether to buy it without hiding anything
// from anyone who opens devtools. These routes make the same data public on
// purpose, rendered server-side so it is indexable and unfurls in WhatsApp.
@ApiTags('Catalog')
@Public()
@Throttle({ default: { limit: 120, ttl: 60000 } })
@Controller('catalog')
export class ContentController {
  constructor(
    private lecturesService: LecturesService,
    private termsService: TermsService,
  ) {}

  @Get('lectures')
  @ApiOperation({ summary: 'Published lectures, filterable by grade and year' })
  async catalog(@Query() query: CatalogQueryDto) {
    return this.lecturesService.catalog(query);
  }

  @Get('terms')
  @ApiOperation({ summary: 'Non-archived terms' })
  async terms() {
    return this.termsService.findAll(false);
  }

  @Get('lectures/:slug')
  @ApiOperation({ summary: 'One published lecture with its curriculum outline' })
  async bySlug(@Param('slug') slug: string): Promise<ApiResponse<Record<string, unknown>>> {
    return this.lecturesService.findBySlug(slug);
  }
}
