import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const nullableUrl = z.string().url().nullable().optional();

export const updateSettingsSchema = z.object({
  // Public
  siteName: z.string().trim().min(1).max(120).optional(),
  tagline: z.string().trim().max(300).nullable().optional(),
  teacherName: z.string().trim().max(120).nullable().optional(),
  teacherBio: z.string().trim().max(2000).nullable().optional(),
  teacherPhoto: z.string().trim().max(500).nullable().optional(),
  logo: z.string().trim().max(500).nullable().optional(),
  heroImage: z.string().trim().max(500).nullable().optional(),
  // Digits only, no leading + — the form wa.me links require.
  whatsappNumber: z
    .string()
    .regex(/^\d{8,15}$/, 'whatsappNumber must be digits only in international format, e.g. 201044175784')
    .nullable()
    .optional(),
  socialLinks: z
    .object({
      facebook: nullableUrl,
      youtube: nullableUrl,
      tiktok: nullableUrl,
      instagram: nullableUrl,
    })
    .optional(),
  isRegistrationOpen: z.boolean().optional(),

  // Admin only
  currency: z.string().trim().min(1).max(10).optional(),
  defaultAccessDurationDays: z.number().int().min(1).nullable().optional(),
  currentAcademicYear: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, 'currentAcademicYear must look like 2026/2027')
    .optional(),
  purchaseRequestExpiryHours: z.number().int().min(1).max(720).optional(),
});

export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
