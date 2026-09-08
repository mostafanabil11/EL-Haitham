import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export class OtpUtils {
  static generateOtp(length: number = 6): string {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += crypto.randomInt(0, 10).toString();
    }
    return otp;
  }

  static async hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
  }

  static async verifyOtp(otp: string, hashedOtp: string): Promise<boolean> {
    return bcrypt.compare(otp, hashedOtp);
  }

  static getOtpExpiryTime(minutes: number = 10): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  static isOtpExpired(expiryTime: Date | null): boolean {
    if (!expiryTime) return true;
    return new Date() > expiryTime;
  }
}
