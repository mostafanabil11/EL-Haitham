import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LearnService } from './learn.service';
import { LearnController } from './learn.controller';
import { Progress, ProgressSchema } from './schemas/progress.schema';
import { User, UserSchema } from '@/auth/schemas/user.schema';
import { ContentModule } from '@/content/content.module';
import { CommerceModule } from '@/commerce/commerce.module';
import { VideoModule } from '@/video/video.module';
import { ConfigModule } from '@/config/config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Progress.name, schema: ProgressSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ContentModule,
    CommerceModule,
    VideoModule,
    ConfigModule,
  ],
  controllers: [LearnController],
  providers: [LearnService],
  exports: [LearnService],
})
export class LearnModule {}
