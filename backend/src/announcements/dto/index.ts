import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { GRADES } from '@/common/constants/grades';
import { AUDIENCES } from '../schemas/announcement.schema';

const objectId = z.string().length(24, 'معرّف غير صحيح');

export const createAnnouncementSchema = z
  .object({
    titleAr: z.string().trim().min(2).max(200),
    bodyAr: z.string().trim().min(2).max(4000),
    audience: z.enum(AUDIENCES).default('all'),
    grade: z.enum(GRADES).nullable().optional(),
    lectureId: objectId.nullable().optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
    isPinned: z.boolean().optional(),
  })
  // An audience with no target reaches nobody, and looks published in the
  // admin list while every student sees an empty feed — the kind of failure
  // that is only discovered by a support message.
  .refine((v) => v.audience !== 'grade' || !!v.grade, {
    message: 'اختر الصف الدراسي',
    path: ['grade'],
  })
  .refine((v) => v.audience !== 'lecture' || !!v.lectureId, {
    message: 'اختر المحاضرة',
    path: ['lectureId'],
  });
export class CreateAnnouncementDto extends createZodDto(createAnnouncementSchema) {}

export const updateAnnouncementSchema = z.object({
  titleAr: z.string().trim().min(2).max(200).optional(),
  bodyAr: z.string().trim().min(2).max(4000).optional(),
  audience: z.enum(AUDIENCES).optional(),
  grade: z.enum(GRADES).nullable().optional(),
  lectureId: objectId.nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  isPinned: z.boolean().optional(),
});
export class UpdateAnnouncementDto extends createZodDto(updateAnnouncementSchema) {}

export const publishAnnouncementSchema = z.object({ isPublished: z.boolean() });
export class PublishAnnouncementDto extends createZodDto(publishAnnouncementSchema) {}
