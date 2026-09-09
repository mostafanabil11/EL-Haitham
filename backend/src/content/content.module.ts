import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LecturesService } from './lectures.service';
import { TermsService } from './terms.service';
import { ContentController } from './content.controller';
import { ContentAdminController } from './content.admin.controller';
import { Term, TermSchema } from './schemas/term.schema';
import { Lecture, LectureSchema } from './schemas/lecture.schema';
import { LectureItem, LectureItemSchema } from './schemas/lecture-item.schema';
import { SettingsModule } from '@/settings/settings.module';
import { ConfigModule } from '@/config/config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Term.name, schema: TermSchema },
      { name: Lecture.name, schema: LectureSchema },
      { name: LectureItem.name, schema: LectureItemSchema },
    ]),
    SettingsModule,
    // Deciding whether a pasted value is a YouTube link depends on the
    // configured provider.
    ConfigModule,
  ],
  controllers: [ContentController, ContentAdminController],
  providers: [LecturesService, TermsService],
  exports: [LecturesService, TermsService, MongooseModule],
})
export class ContentModule {}
