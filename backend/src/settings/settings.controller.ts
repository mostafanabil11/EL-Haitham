import { Controller, Get, Patch, Body, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Public } from '@/auth/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';

@ApiTags('Settings')
@UseInterceptors(AuditInterceptor)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  // The only settings route a logged-out visitor can reach. Returns the
  // PUBLIC_SETTINGS_FIELDS projection — never the whole document.
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('public')
  @ApiOperation({ summary: 'Branding and contact details needed to render the public site' })
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Roles('admin')
  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Full settings document (admin only)' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Roles('admin')
  @Audit('settings.update')
  @Patch()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update settings (admin only)' })
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
