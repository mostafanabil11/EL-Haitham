import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsAdminController } from './announcements.admin.controller';
import { Announcement, AnnouncementSchema } from './schemas/announcement.schema';
import { Enrollment, EnrollmentSchema } from '@/commerce/schemas/enrollment.schema';
import { User, UserSchema } from '@/auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Announcement.name, schema: AnnouncementSchema },
      // Read-only: deciding whether a lecture-scoped notice applies needs the
      // student's enrollments and their grade.
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AnnouncementsController, AnnouncementsAdminController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
