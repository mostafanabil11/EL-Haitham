import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '../config/config.service';
import { SettingsService } from '@/settings/settings.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { DeviceInfo } from './interfaces/device-info.interface';
import { parseDurationToMs } from '@/common/utils/duration.util';
import { toLocalEgyptianPhone } from '@/common/utils/phone.util';

import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private settingsService: SettingsService,
    private eventEmitter: EventEmitter2,
  ) {}

  // A duplicate-key error names the index that rejected the write in
  // `keyPattern`. Reporting it accurately matters: mapping every 11000 to
  // "this phone is taken" told a student to go and sign in when the real
  // collision was on their email address, which is unactionable advice.
  private duplicateKeyMessage(error: { keyPattern?: Record<string, unknown> }): string {
    const field = Object.keys(error.keyPattern ?? {})[0];
    switch (field) {
      case 'phone':
        return 'هذا الرقم مسجل بالفعل. سجّل الدخول بدلاً من ذلك.';
      case 'email':
        return 'هذا البريد الإلكتروني مسجل بالفعل.';
      default:
        return 'هذه البيانات مسجلة بالفعل.';
    }
  }

  // The shape every endpoint returns a user as. An allow-list, not a
  // blacklist: a field added to the schema later is private until someone
  // deliberately adds it here, so loginAttempts, lockedUntil, otpHash and
  // sessions cannot leak by omission.
  private toPublicUser(user: UserDocument) {
    return {
      id: user._id.toString(),
      phone: user.phone,
      // Both numbers are echoed back in the local form as well as the stored
      // one. 01044175784 is what a student recognises as their number;
      // 201044175784 is only the canonical key. Showing one of the two
      // numbers localized and the other not made the profile page look like
      // it held two different kinds of data.
      phoneLocal: toLocalEgyptianPhone(user.phone),
      parentPhone: user.parentPhone,
      parentPhoneLocal: toLocalEgyptianPhone(user.parentPhone),
      name: user.name,
      grade: user.grade,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async register(registerDto: RegisterDto, deviceInfo: DeviceInfo) {
    const { name, phone, parentPhone, grade, password, email } = registerDto;

    const { data: settings } = await this.settingsService.getPublicSettings();
    if (settings && settings.isRegistrationOpen === false) {
      throw new ForbiddenException('التسجيل مغلق حالياً. تواصل مع المدرس.');
    }

    // Checked explicitly for a clear Arabic message, but the unique index on
    // `phone` is what actually guarantees it under two concurrent signups —
    // the catch below turns that race into the same friendly error.
    const existingUser = await this.userModel.findOne({ phone });
    if (existingUser) {
      throw new ConflictException('هذا الرقم مسجل بالفعل. سجّل الدخول بدلاً من ذلك.');
    }

    if (email) {
      const existingEmail = await this.userModel.findOne({ email });
      if (existingEmail) {
        throw new ConflictException('هذا البريد الإلكتروني مسجل بالفعل.');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user: UserDocument;
    try {
      user = new this.userModel({
        name,
        phone,
        parentPhone,
        grade,
        email: email ?? null,
        password: hashedPassword,
        role: 'student',
      });
      await user.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(this.duplicateKeyMessage(error));
      }
      throw error;
    }

    // Signed in immediately. There is no verification step to wait on — the
    // incumbent makes a student register and then log in again, which is a
    // pointless second form on a phone keyboard.
    const { accessToken, refreshToken } = await this.generateTokens(user, deviceInfo);

    this.eventEmitter.emit('user.registered', { phone, name, email });

    return {
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      data: { accessToken, refreshToken, user: this.toPublicUser(user) },
    };
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Refresh tokens are hashed with sha256, not bcrypt — bcrypt silently
  // truncates its input at 72 bytes, and these JWTs run well past that
  // (~250 chars, with only the tail — iat/exp/signature — varying between
  // issuances). bcrypt.compare() against a truncated hash would therefore
  // treat *any* refresh token ever issued to a user as a match for any
  // other, defeating rotation-based reuse detection entirely. sha256 has
  // no truncation and the token is already high-entropy, so no slow
  // password-style hash is needed here anyway.
  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Finds which of a user's sessions (if any) a presented refresh token
  // belongs to. Bounded by how many devices one person is signed in on.
  private findSessionIndex(user: UserDocument, refreshToken: string): number {
    const candidateHash = Buffer.from(this.hashRefreshToken(refreshToken));
    return user.sessions.findIndex((session) => {
      const storedHash = Buffer.from(session.tokenHash);
      return storedHash.length === candidateHash.length && crypto.timingSafeEqual(storedHash, candidateHash);
    });
  }

  private async generateTokens(user: UserDocument, deviceInfo: DeviceInfo) {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      phone: user.phone,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: this.configService.jwtExpiration },
    );

    // Signed (not opaque random) so refresh() can identify the user straight
    // from the cookie without a separate userId param — still hashed at rest
    // below, so a leaked DB row alone can't be replayed as a refresh token.
    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: this.configService.jwtRefreshExpiration },
    );
    const hashedRefreshToken = this.hashRefreshToken(refreshToken);
    const now = new Date();

    // Drop anything already expired before adding this one — keeps the array
    // from growing forever across devices that never explicitly log out.
    user.sessions = user.sessions.filter((session) => session.expiresAt > now);
    user.sessions.push({
      _id: new Types.ObjectId(),
      tokenHash: hashedRefreshToken,
      userAgent: deviceInfo.userAgent,
      ip: deviceInfo.ip,
      createdAt: now,
      expiresAt: new Date(now.getTime() + parseDurationToMs(this.configService.jwtRefreshExpiration)),
    });
    await user.save();

    return { accessToken, refreshToken };
  }

  async login(loginDto: LoginDto, deviceInfo: DeviceInfo) {
    const { phone, password } = loginDto;

    const user = await this.userModel.findOne({ phone });
    if (!user) {
      throw new UnauthorizedException('رقم الهاتف أو كلمة المرور غير صحيحة');
    }

    // Deliberately NOT gated on isPhoneVerified: nothing can verify a phone
    // yet (no WhatsApp API is wired up), so gating here would lock out every
    // student on the platform. See the schema comment on isPhoneVerified.

    if (!user.isActive) {
      throw new ForbiddenException('هذا الحساب موقوف. تواصل مع المدرس.');
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new UnauthorizedException('تم قفل الحساب مؤقتاً بسبب محاولات كثيرة. حاول بعد قليل.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.lastLoginAttempt = new Date();

      const maxAttempts = this.configService.get<number>('MAX_LOGIN_ATTEMPTS') ?? 5;
      const lockMinutes = this.configService.get<number>('LOCK_TIME_MINUTES') ?? 15;

      if (user.loginAttempts >= maxAttempts) {
        user.lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
        await user.save();
        throw new UnauthorizedException(
          `محاولات كثيرة خاطئة. تم قفل الحساب لمدة ${lockMinutes} دقيقة.`,
        );
      }

      await user.save();
      throw new UnauthorizedException('رقم الهاتف أو كلمة المرور غير صحيحة');
    }

    user.loginAttempts = 0;
    user.lastLoginAttempt = new Date();
    user.lockedUntil = null;

    const { accessToken, refreshToken } = await this.generateTokens(user, deviceInfo);

    return {
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: { accessToken, refreshToken, user: this.toPublicUser(user) },
    };
  }

  async refresh(refreshToken: string, deviceInfo: DeviceInfo) {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Access denied');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Access denied');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Access denied');
    }

    const sessionIndex = this.findSessionIndex(user, refreshToken);
    if (sessionIndex === -1) {
      throw new UnauthorizedException('Access denied');
    }

    // Rotation: this device's old refresh token is consumed here and
    // generateTokens() below issues it a fresh one — every other device's
    // session is untouched.
    user.sessions.splice(sessionIndex, 1);

    const tokens = await this.generateTokens(user, deviceInfo);
    return {
      success: true,
      message: 'Tokens refreshed',
      data: tokens,
    };
  }

  async logout(userId: string, refreshToken: string | undefined) {
    const user = await this.userModel.findById(userId);
    if (user && refreshToken) {
      // Only end *this* device's session — signing out on the phone
      // shouldn't sign out the desktop too.
      const sessionIndex = this.findSessionIndex(user, refreshToken);
      if (sessionIndex !== -1) {
        user.sessions.splice(sessionIndex, 1);
        await user.save();
      }
    }

    return {
      success: true,
      message: 'تم تسجيل الخروج',
      data: null,
    };
  }

  async validateUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user || !user.isActive) {
      return null;
    }

    return { _id: user._id.toString(), ...this.toPublicUser(user) };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.parentPhone !== undefined) user.parentPhone = dto.parentPhone;
    if (dto.grade !== undefined) user.grade = dto.grade;
    if (dto.email !== undefined) user.email = dto.email;

    try {
      await user.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(this.duplicateKeyMessage(error));
      }
      throw error;
    }

    return {
      success: true,
      message: 'تم تحديث البيانات',
      data: this.toPublicUser(user),
    };
  }

  // Invalidates every session (this device included) on success — the same
  // "assume the old password may be compromised" posture as a reset, so a
  // stolen refresh token can't outlive the password that was just changed.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('كلمة المرور الحالية غير صحيحة');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.sessions = [];
    await user.save();

    return {
      success: true,
      message: 'تم تغيير كلمة المرور — سجّل الدخول مرة أخرى',
      data: null,
    };
  }

  // Self-service reset, available only to accounts that supplied an email —
  // in practice the teacher's own admin account and the handful of students
  // who bothered. Everyone else goes through adminResetPassword() below.
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.userModel.findOne({ email });

    const genericResponse = {
      success: true,
      message: 'إذا كان البريد الإلكتروني مسجلاً، فسيصلك رابط إعادة التعيين.',
    };

    if (!user) {
      return genericResponse;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = this.hashResetToken(resetToken);
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    this.eventEmitter.emit('user.forgot-password', { email, name: user.name, resetToken });

    return genericResponse;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const targetUser = await this.userModel.findOne({
      resetPasswordToken: this.hashResetToken(token),
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!targetUser) {
      throw new BadRequestException('رابط إعادة التعيين غير صالح أو منتهي الصلاحية');
    }

    targetUser.password = await bcrypt.hash(newPassword, 10);
    targetUser.resetPasswordToken = null;
    targetUser.resetPasswordExpiresAt = null;
    targetUser.lockedUntil = null;
    targetUser.loginAttempts = 0;
    targetUser.sessions = [];

    await targetUser.save();

    return {
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
    };
  }

  // The realistic reset path on this platform: a student messages the teacher
  // on WhatsApp having forgotten their password, and he sets a new one from
  // the admin panel and tells them what it is. Audited by the controller.
  async adminResetPassword(targetUserId: string, newPassword: string) {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('الطالب غير موجود');
    }

    if (user.role === 'admin') {
      throw new ForbiddenException('لا يمكن إعادة تعيين كلمة مرور حساب المدرس من هنا');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    // Every device that student was signed in on is signed out, so a shared
    // password that prompted the reset stops working immediately.
    user.sessions = [];
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    return {
      success: true,
      message: 'تم تعيين كلمة مرور جديدة للطالب',
      data: this.toPublicUser(user),
    };
  }
}
