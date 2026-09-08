import {
  Controller,
  Post,
  Patch,
  Body,
  Get,
  Request,
  Res,
  HttpCode,
  Param,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangePasswordDto,
  AdminResetPasswordDto,
} from './dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Response } from 'express';
import { RequestUser } from './interfaces/request-user.interface';
import { DeviceInfo } from './interfaces/device-info.interface';
import { ConfigService } from '@/config/config.service';
import { parseDurationToMs } from '@/common/utils/duration.util';
import { Roles } from '@/common/decorators/roles.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';
import { LoginResponseDto, RegisterResponseDto } from './dto/auth-response.dto';

// Read straight from process.env rather than ConfigService because a
// decorator argument is evaluated when the class is defined, long before
// Nest's DI container exists. Validated in env.validation.ts all the same.
//
// Configurable rather than hardcoded so the limit can be tightened in
// production and relaxed for an end-to-end test run — a fixed 5/min made the
// auth suite fail depending on what had already run that minute, which is the
// kind of flakiness that gets a test suite ignored.
const AUTH_THROTTLE = {
  default: {
    limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5),
    ttl: 60000,
  },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  // In development the API and the site share localhost, so they are same-site
  // and Lax works (and keeps a little CSRF protection for free). Deployed,
  // they sit on different domains — a Vercel one and an API one — which makes
  // every request cross-site, and a Lax cookie is simply not sent on those.
  // Login would appear to succeed and every request after it would arrive
  // signed out. SameSite=None is what allows the cookie through, and browsers
  // only accept None together with Secure.
  private get cookieOptions() {
    const isProduction = this.configService.nodeEnv === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      path: '/',
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const base = this.cookieOptions;

    res.cookie('accessToken', accessToken, {
      ...base,
      maxAge: parseDurationToMs(this.configService.jwtExpiration),
    });
    res.cookie('refreshToken', refreshToken, {
      ...base,
      maxAge: parseDurationToMs(this.configService.jwtRefreshExpiration),
    });
  }

  // Clearing a cookie only works when the attributes match the ones it was set
  // with, so this deliberately reuses the same options rather than passing a
  // bare path — otherwise sign-out would silently leave the session cookie in
  // place in production.
  private clearAuthCookies(res: Response) {
    res.clearCookie('accessToken', this.cookieOptions);
    res.clearCookie('refreshToken', this.cookieOptions);
  }

  private getDeviceInfo(req: any): DeviceInfo {
    return {
      userAgent: req.headers?.['user-agent'] ?? null,
      ip: req.ip ?? null,
    };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Register a student with a phone number and sign them in' })
  @ApiResponse({ status: 201, type: RegisterResponseDto })
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto, this.getDeviceInfo(req));
    this.setAuthCookies(res, result.data.accessToken, result.data.refreshToken);
    // The refresh token lives in the httpOnly cookie set above; echoing it in
    // the body as well would put it somewhere JavaScript can read.
    const { refreshToken, ...data } = result.data;
    return { ...result, data };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with a phone number and password' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, this.getDeviceInfo(req));
    this.setAuthCookies(res, result.data.accessToken, result.data.refreshToken);
    const { refreshToken, ...data } = result.data;
    return { ...result, data };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token cookie and issue a new access token' })
  async refresh(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const result = await this.authService.refresh(refreshToken, this.getDeviceInfo(req));
    this.setAuthCookies(res, result.data.accessToken, result.data.refreshToken);
    return { success: true, message: result.message, data: null };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Email a password reset link (accounts with an email only)' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete a password reset with an emailed token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current signed-in user' })
  async getProfile(@CurrentUser() user: RequestUser) {
    return {
      success: true,
      message: 'Profile retrieved',
      data: await this.authService.validateUser(user.userId),
    };
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update name, parent phone, grade or email' })
  async updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change your own password; signs out every device' })
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.userId, dto);
    this.clearAuthCookies(res);
    return result;
  }

  // The teacher resetting a student's password after a WhatsApp request. This
  // is the only reset route available to a student with no email address, so
  // it is a normal part of running the platform rather than an edge case —
  // hence the audit entry.
  @Roles('admin')
  @UseInterceptors(AuditInterceptor)
  @Audit('user.admin_reset_password')
  @Post('admin/students/:id/reset-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set a student's password directly (admin only)" })
  async adminResetPassword(@Param('id') id: string, @Body() dto: AdminResetPasswordDto) {
    return this.authService.adminResetPassword(id, dto.newPassword);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out of this device only' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(user.userId, req.cookies?.refreshToken);
    this.clearAuthCookies(res);
    return result;
  }
}
