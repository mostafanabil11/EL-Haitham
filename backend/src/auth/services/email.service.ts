import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@/config/config.service';

interface Message {
  to: string;
  subject: string;
  html: string;
  /** Prefixed to log lines so a missing email traces back to what caused it. */
  context?: string;
}

/**
 * Two ways out of the building, chosen by what is configured:
 *
 *   Brevo (HTTP)  — an ordinary HTTPS request, so hosts that block SMTP can't
 *                   block it. Render's free instances refuse outbound traffic
 *                   on ports 25, 465 and 587, which is why SMTP worked in
 *                   development and silently did nothing once deployed.
 *   SMTP (Gmail)  — kept for local development, where nothing is blocked and
 *                   an App Password is the quickest thing to have working.
 *
 * Neither configured means nothing is delivered, which is a legitimate state
 * for this platform to run in — most students have no email address at all.
 * It just has to say so rather than pretend.
 */
type Transport = 'brevo' | 'smtp' | 'none';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transport: Transport;
  private smtpTransporter?: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transport = this.selectTransport();
    this.announce();
  }

  private selectTransport(): Transport {
    if (this.configService.brevoApiKey) return 'brevo';
    if (this.configService.isSmtpConfigured) return 'smtp';
    return 'none';
  }

  private announce() {
    if (this.transport === 'brevo') {
      this.logger.log(`Email transport: Brevo HTTP API, sending as ${this.configService.mailFromAddress}`);
      return;
    }

    if (this.transport === 'smtp') {
      this.smtpTransporter = nodemailer.createTransport({
        // Spelled out rather than service:'gmail' so the port is visible in
        // the config: when a host blocks outbound mail, knowing which port was
        // tried is the difference between a diagnosable failure and a mystery.
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          // Google prints App Passwords in four blocks for readability; the
          // spaces are presentation, not part of the secret.
          user: this.configService.get<string>('EMAIL_USER')?.trim(),
          pass: this.configService.get<string>('EMAIL_PASSWORD')?.replace(/\s+/g, ''),
        },
        // Without these nodemailer waits minutes on a blocked port, so the
        // failure surfaces long after the request that caused it.
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      // Answers "can mail leave this host" at startup rather than when a
      // customer's confirmation quietly fails to arrive. Not awaited: email is
      // not worth delaying boot for.
      void this.smtpTransporter
        .verify()
        .then(() => this.logger.log('Email transport: SMTP verified'))
        .catch((err: Error) =>
          this.logger.error(
            `Email transport: SMTP verification FAILED, nothing will be delivered — ${err.message}. ` +
              'If this host blocks SMTP ports, set BREVO_API_KEY to send over HTTPS instead.',
          ),
        );
      return;
    }

    this.logger.warn(
      'No email transport configured (set BREVO_API_KEY, or EMAIL_USER + EMAIL_PASSWORD) — ' +
        'password resets and OTPs will NOT be delivered.',
    );
  }

  /** True when messages actually leave the building. */
  get isConfigured(): boolean {
    return this.transport !== 'none';
  }

  /**
   * The one place a message is actually sent. Every send* method below is a
   * subject line and a template; this owns transport, logging and failure.
   *
   * Returns false rather than throwing. Email is a side channel on this
   * platform — most students have no address at all — so a failed send must
   * never take down the action that triggered it. Callers that genuinely
   * depend on delivery, such as a password reset, check the return value and
   * raise their own error.
   */
  private async deliver({ to, subject, html, context }: Message): Promise<boolean> {
    const label = context ? `${context}: ` : '';

    if (this.transport === 'none') {
      this.logger.warn(`${label}not sent to ${to} — no email transport configured`);
      return false;
    }

    try {
      if (this.transport === 'brevo') {
        await this.deliverViaBrevo({ to, subject, html });
      } else {
        await this.smtpTransporter!.sendMail({
          from: `"${this.configService.mailFromName}" <${this.configService.mailFromAddress}>`,
          to,
          subject,
          html,
        });
      }

      this.logger.log(`${label}email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`${label}email to ${to} FAILED — ${(error as Error).message}`);
      return false;
    }
  }

  private async deliverViaBrevo({ to, subject, html }: Omit<Message, 'context'>): Promise<void> {
    // Plain fetch rather than the SDK: one endpoint, one header, and a
    // dependency that ships its own HTTP stack isn't worth carrying for it.
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'api-key': this.configService.brevoApiKey!,
      },
      body: JSON.stringify({
        sender: {
          email: this.configService.mailFromAddress,
          name: this.configService.mailFromName,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
      // Nothing waits on this send, but an unbounded request would still pin
      // a handler open indefinitely.
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      // Brevo returns a JSON body explaining the refusal — an unverified
      // sender address is the usual one, and worth surfacing verbatim rather
      // than reporting a bare status code.
      const detail = await response.text().catch(() => '');
      throw new Error(`Brevo responded ${response.status}${detail ? ` — ${detail.slice(0, 300)}` : ''}`);
    }
  }

  // --- Account ---

  async sendOtpEmail(email: string, userName: string, otp: string, htmlTemplate: string): Promise<boolean> {
    const sent = await this.deliver({
      to: email,
      subject: 'رمز التحقق',
      html: htmlTemplate,
      context: 'Verification OTP',
    });
    // A verification code that never arrives makes the whole step pointless,
    // so this one fails loudly rather than returning false.
    if (!sent) {
      throw new Error('Failed to send verification email');
    }
    return true;
  }

  async sendWelcomeEmail(email: string, userName: string, htmlTemplate: string): Promise<boolean> {
    return this.deliver({
      to: email,
      subject: 'أهلاً بك في المنصة',
      html: htmlTemplate,
      context: 'Welcome',
    });
  }

  async sendPasswordResetEmail(
    email: string,
    userName: string,
    htmlTemplate: string,
    resetUrl?: string,
  ): Promise<boolean> {
    const sent = await this.deliver({
      to: email,
      subject: 'إعادة تعيين كلمة المرور',
      html: htmlTemplate,
      context: 'Password reset',
    });
    if (!sent) {
      throw new Error('Failed to send password reset email');
    }
    return true;
  }
}
