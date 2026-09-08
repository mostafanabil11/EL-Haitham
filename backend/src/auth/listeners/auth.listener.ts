import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../services/email.service';
import { EmailUtils } from '../utils/email.utils';
import { ConfigService } from '@/config/config.service';

// Email is a side channel here, not the main one. Students register with a
// phone and usually no email at all, so the only listener that reliably fires
// is the password reset — and only for the accounts that supplied an address.
// Student-facing notifications go over WhatsApp in a later phase.
@Injectable()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  @OnEvent('user.registered')
  async handleUserRegisteredEvent(payload: { phone: string; name: string; email?: string | null }) {
    if (!payload.email) {
      this.logger.log(`Student registered: ${payload.phone} (no email, nothing to send)`);
      return;
    }

    const emailTemplate = EmailUtils.generateWelcomeEmailTemplate(payload.name);
    await this.emailService.sendWelcomeEmail(payload.email, payload.name, emailTemplate);
  }

  @OnEvent('user.forgot-password')
  async handleUserForgotPasswordEvent(payload: { email: string; name: string; resetToken: string }) {
    const resetUrl = new URL('/reset-password', this.configService.frontendUrl);
    resetUrl.searchParams.set('token', payload.resetToken);
    const emailTemplate = EmailUtils.generatePasswordResetEmailTemplate(payload.name, resetUrl.toString());
    await this.emailService.sendPasswordResetEmail(
      payload.email,
      payload.name,
      emailTemplate,
      resetUrl.toString(),
    );
  }
}
