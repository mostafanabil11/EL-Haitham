import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from './schemas/user.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigService } from '@/config/config.service';
import { ConfigModule } from '@/config/config.module';
import { SettingsModule } from '@/settings/settings.module';
import { EmailService } from './services/email.service';
import { AuthListener } from './listeners/auth.listener';

// Google OAuth was removed deliberately. This platform's
// identity is a phone number — Google hands back an email and no phone, so a
// Google sign-in would create an account missing the two fields every other
// part of the system depends on (phone, parentPhone) and there would be no
// way to fill them in without asking anyway.
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    SettingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: configService.jwtExpiration },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailService, AuthListener],
  exports: [AuthService, JwtModule, PassportModule, EmailService],
})
export class AuthModule {}
