import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { GRADES } from '@/common/constants/grades';
import { ITEM_TYPES } from '../schemas/lecture-item.schema';

const academicYear = z
  .string()
  .regex(/^\d{4}\/\d{4}$/, 'العام الدراسي يجب أن يكون بالشكل 2026/2027');

// --- Terms ---

export const createTermSchema = z.object({
  titleAr: z.string().trim().min(2).max(120),
  grade: z.enum(GRADES),
  academicYear,
  order: z.number().int().min(0).optional(),
});
export class CreateTermDto extends createZodDto(createTermSchema) {}

export const updateTermSchema = createTermSchema.partial().extend({
  isArchived: z.boolean().optional(),
});
export class UpdateTermDto extends createZodDto(updateTermSchema) {}

// --- Lectures ---

export const createLectureSchema = z.object({
  titleAr: z.string().trim().min(2).max(200),
  termId: z.string().length(24, 'معرّف الترم غير صحيح'),
  // Minor units. Rejecting a float here rather than rounding it silently:
  // 65.5 piastres is not a thing, and accepting it would put a fractional
  // price into a total that is meant to be exact.
  priceMinorUnits: z.number().int('السعر يجب أن يكون بالقروش كعدد صحيح').min(0),
  description: z.string().trim().max(3000).nullable().optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
  accessDurationDays: z.number().int().min(1).nullable().optional(),
  order: z.number().int().min(0).optional(),
});
export class CreateLectureDto extends createZodDto(createLectureSchema) {}

export const updateLectureSchema = createLectureSchema
  .omit({ termId: true })
  .partial()
  .extend({
    // Moving a lecture to another term is allowed, but it re-derives grade and
    // academicYear from the destination — see LecturesService.update.
    termId: z.string().length(24).optional(),
    isArchived: z.boolean().optional(),
  });
export class UpdateLectureDto extends createZodDto(updateLectureSchema) {}

export const publishLectureSchema = z.object({
  isPublished: z.boolean(),
});
export class PublishLectureDto extends createZodDto(publishLectureSchema) {}

// --- Lecture items ---

export const createLectureItemSchema = z
  .object({
    titleAr: z.string().trim().min(2).max(200),
    type: z.enum(ITEM_TYPES),
    videoAssetId: z.string().trim().max(200).nullable().optional(),
    videoDurationSeconds: z.number().int().min(0).optional(),
    contentHtml: z.string().max(50_000).nullable().optional(),
    attachments: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          key: z.string().trim().min(1).max(500),
          sizeBytes: z.number().int().min(0).optional(),
          mimeType: z.string().trim().max(120).nullable().optional(),
        }),
      )
      .optional(),
    isFreePreview: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  })
  // A 'text' item with no text, or a 'pdf' with no file, is a broken lesson
  // that looks fine in the admin list and shows a student an empty page. It is
  // cheaper to refuse it here than to explain it later.
  .refine((v) => v.type !== 'text' || (v.contentHtml ?? '').trim().length > 0, {
    message: 'درس نصي يجب أن يحتوي على محتوى',
    path: ['contentHtml'],
  })
  .refine((v) => v.type !== 'pdf' || (v.attachments ?? []).length > 0, {
    message: 'درس ملف يجب أن يحتوي على مرفق واحد على الأقل',
    path: ['attachments'],
  });
export class CreateLectureItemDto extends createZodDto(createLectureItemSchema) {}

// Partial updates cannot run the cross-field checks above (the type may not be
// in the payload at all), so the service re-validates the merged document.
export const updateLectureItemSchema = z.object({
  titleAr: z.string().trim().min(2).max(200).optional(),
  type: z.enum(ITEM_TYPES).optional(),
  videoAssetId: z.string().trim().max(200).nullable().optional(),
  videoDurationSeconds: z.number().int().min(0).optional(),
  contentHtml: z.string().max(50_000).nullable().optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        key: z.string().trim().min(1).max(500),
        sizeBytes: z.number().int().min(0).optional(),
        mimeType: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .optional(),
  isFreePreview: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});
export class UpdateLectureItemDto extends createZodDto(updateLectureItemSchema) {}

// --- Reordering ---

export const reorderSchema = z.object({
  // Full ordered list of ids. Sending the whole array rather than {id, from,
  // to} makes the operation idempotent and immune to two admins dragging at
  // once — last write wins on a complete, coherent order.
  ids: z.array(z.string().length(24)).min(1).max(500),
});
export class ReorderDto extends createZodDto(reorderSchema) {}

// --- Public catalogue query ---

export const catalogQuerySchema = z.object({
  grade: z.enum(GRADES).optional(),
  academicYear: academicYear.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
});
export class CatalogQueryDto extends createZodDto(catalogQuerySchema) {}
