/**
 * The three transactional emails this platform actually sends.
 *
 * Email is a side channel here, not the main one: students register with a
 * phone number and usually no email at all, so only the accounts that supplied
 * an address ever receive any of this. Everything student-facing goes over
 * WhatsApp instead.
 *
 * All three are Arabic and RTL, and the site name is passed in rather than
 * hardcoded, so a rename never leaves a stale brand sitting in an inbox.
 */
export class EmailUtils {
  private static readonly DEFAULT_SITE = 'منصة اللغة العربية';

  /**
   * One shell for every message.
   *
   * `dir="rtl"` and an explicit Arabic font stack both matter more in email
   * than on the web: mail clients apply no page styles of their own, and
   * Gmail and Outlook will otherwise lay Arabic out left to right with a
   * Latin fallback face.
   */
  private static wrap(title: string, bodyHtml: string, siteName: string): string {
    return `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f4f4f4; direction: rtl; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px; border-radius: 8px; }
            .header { text-align: center; color: #14161a; margin-bottom: 20px; }
            .content { color: #5b6472; line-height: 1.8; }
            .code-box { background-color: #f0f2f5; padding: 20px; text-align: center; border-radius: 6px; margin: 20px 0; }
            .code { font-size: 30px; font-weight: bold; color: #1f6feb; letter-spacing: 4px; direction: ltr; }
            .button-box { text-align: center; margin: 24px 0; }
            .button { display: inline-block; background-color: #1f6feb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: bold; }
            .fallback-link { word-break: break-all; font-size: 12px; color: #5b6472; direction: ltr; text-align: left; }
            .footer { text-align: center; color: #9aa4b2; font-size: 12px; margin-top: 24px; }
            .warning { color: #e74c3c; font-size: 12px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>${title}</h1></div>
            <div class="content">${bodyHtml}</div>
            <div class="footer"><p>${siteName}</p></div>
          </div>
        </body>
      </html>
    `;
  }

  static generateWelcomeEmailTemplate(userName: string, siteName = EmailUtils.DEFAULT_SITE): string {
    return this.wrap(
      `أهلاً بك في ${siteName}`,
      `
        <p>أهلاً ${userName}،</p>
        <p>تم إنشاء حسابك بنجاح. يمكنك الآن تسجيل الدخول وتصفح المحاضرات.</p>
        <p>لتفعيل محاضرة اشتريتها، ادخل على صفحة «تفعيل كود» وأدخل الكود الذي وصلك على واتساب.</p>
        <p>بالتوفيق.</p>
      `,
      siteName,
    );
  }

  static generatePasswordResetEmailTemplate(
    userName: string,
    resetUrl: string,
    siteName = EmailUtils.DEFAULT_SITE,
  ): string {
    return this.wrap(
      'إعادة تعيين كلمة المرور',
      `
        <p>أهلاً ${userName}،</p>
        <p>وصلنا طلب لإعادة تعيين كلمة المرور الخاصة بحسابك. اضغط الزر بالأسفل لاختيار كلمة مرور جديدة:</p>

        <div class="button-box">
          <a class="button" href="${resetUrl}">إعادة تعيين كلمة المرور</a>
        </div>

        <p>أو انسخ هذا الرابط والصقه في المتصفح:</p>
        <p class="fallback-link">${resetUrl}</p>

        <p>الرابط صالح لمدة ساعة واحدة.</p>
        <p class="warning">⚠️ إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة.</p>
      `,
      siteName,
    );
  }

  /**
   * Kept for the day a verification code needs an email fallback. The live
   * path is WhatsApp — a student with no email address cannot receive this.
   */
  static generateOtpEmailTemplate(
    userName: string,
    otp: string,
    siteName = EmailUtils.DEFAULT_SITE,
  ): string {
    return this.wrap(
      'رمز التحقق',
      `
        <p>أهلاً ${userName}،</p>
        <p>رمز التحقق الخاص بك:</p>

        <div class="code-box">
          <div class="code">${otp}</div>
        </div>

        <p>الرمز صالح لمدة 10 دقائق.</p>
        <p class="warning">⚠️ إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
      `,
      siteName,
    );
  }
}
