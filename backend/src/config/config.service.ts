import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvConfig } from './env.validation';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService<EnvConfig>) {}

  get<T = any>(key: keyof EnvConfig): T | undefined {
    return this.configService.get<T>(key);
  }

  get mongodbUri(): string {
    return this.configService.get<string>('MONGODB_URI')!;
  }

  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET')!;
  }

  get jwtExpiration(): string {
    return this.configService.get<string>('JWT_EXPIRATION')!;
  }

  get jwtRefreshExpiration(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRATION')!;
  }

  get port(): number {
    return this.configService.get<number>('PORT')!;
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV')!;
  }

  // The canonical site URL — used wherever a single address is needed, such as
  // the post-OAuth redirect.
  get frontendUrl(): string {
    return this.frontendUrls[0];
  }

  // FRONTEND_URL may hold several comma-separated origins, because a deployed
  // site legitimately has more than one: the production domain, a custom
  // domain, and Vercel's per-branch preview URLs. All of them need to pass
  // CORS. The first entry is treated as canonical.
  get frontendUrls(): string[] {
    return this.configService
      .get<string>('FRONTEND_URL')!
      .split(',')
      .map((url) => url.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // Preferred transport in production: an HTTPS API, which hosts that block
  // outbound SMTP ports cannot block. Render's free instances refuse traffic on
  // 25, 465 and 587, so SMTP works in development and silently does nothing
  // once deployed.
  get brevoApiKey(): string | undefined {
    return this.get<string>('BREVO_API_KEY')?.trim() || undefined;
  }

  // Gmail over SMTP — kept for local development, where nothing is blocked.
  get isSmtpConfigured(): boolean {
    return Boolean(this.get('EMAIL_USER') && this.get('EMAIL_PASSWORD'));
  }

  // Order confirmations, OTPs and password resets all go through one of the
  // two. Without either the app still runs — orders are placed, accounts still
  // work — but nothing is delivered, so this is checked explicitly rather than
  // left to fail per message.
  get isEmailConfigured(): boolean {
    return Boolean(this.brevoApiKey) || this.isSmtpConfigured;
  }

  // The address customers see. Must be one the provider has verified —
  // with Brevo that can be a single confirmed address rather than a whole
  // domain, which is what makes this workable before a brand domain exists.
  get mailFromAddress(): string {
    return (this.get<string>('MAIL_FROM_ADDRESS') || this.get<string>('EMAIL_USER') || '')?.trim();
  }

  get mailFromName(): string {
    return this.get<string>('MAIL_FROM_NAME')?.trim() || 'منصة اللغة العربية';
  }

  // --- Video ---

  get videoProvider(): 'none' | 'bunny' | 'vimeo' | 'youtube' {
    return this.get<'none' | 'bunny' | 'vimeo' | 'youtube'>('VIDEO_PROVIDER') ?? 'none';
  }

  // How long a signed playback URL stays valid. Short enough that a copied
  // link is worthless within hours, long enough to watch a lecture without
  // the URL dying mid-playback.
  get videoTokenTtlMinutes(): number {
    return this.get<number>('VIDEO_TOKEN_TTL_MINUTES') ?? 240;
  }

  // --- Media storage ---

  get isR2Configured(): boolean {
    return Boolean(
      this.get('R2_ACCOUNT_ID') &&
        this.get('R2_ACCESS_KEY_ID') &&
        this.get('R2_SECRET_ACCESS_KEY') &&
        this.get('R2_BUCKET'),
    );
  }
}
