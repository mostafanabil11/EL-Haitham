import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const objectId = z.string().length(24, 'معرّف غير صحيح');

// --- Redemption ---

export const redeemCodeSchema = z.object({
  // Kept permissive on purpose: normalizeCode() handles lowercase, missing
  // dashes and stray spaces. Validating the exact format here would reject
  // input the service can perfectly well understand.
  code: z.string().trim().min(6).max(40),
});
export class RedeemCodeDto extends createZodDto(redeemCodeSchema) {}

// --- Code generation ---

export const generateCodesSchema = z.object({
  targetKind: z.enum(['lecture', 'bundle']),
  targetId: objectId,
  // Capped so a mistyped count cannot generate a hundred thousand rows.
  count: z.number().int().min(1).max(500),
  batchId: z.string().trim().max(60).optional(),
  expiresAt: z.iso.datetime().optional(),
  note: z.string().trim().max(300).optional(),
});
export class GenerateCodesDto extends createZodDto(generateCodesSchema) {}

// --- Purchase requests ---

export const createPurchaseRequestSchema = z.object({
  targetKind: z.enum(['lecture', 'bundle']),
  targetId: objectId,
});
export class CreatePurchaseRequestDto extends createZodDto(createPurchaseRequestSchema) {}

export const confirmPaymentSchema = z.object({
  adminNote: z.string().trim().max(300).optional(),
});
export class ConfirmPaymentDto extends createZodDto(confirmPaymentSchema) {}

// --- Enrollments (admin) ---

export const grantEnrollmentSchema = z.object({
  userId: objectId,
  lectureId: objectId,
});
export class GrantEnrollmentDto extends createZodDto(grantEnrollmentSchema) {}

export const extendEnrollmentSchema = z.object({
  days: z.number().int().min(1).max(730),
});
export class ExtendEnrollmentDto extends createZodDto(extendEnrollmentSchema) {}

export const setEnrollmentActiveSchema = z.object({
  isActive: z.boolean(),
});
export class SetEnrollmentActiveDto extends createZodDto(setEnrollmentActiveSchema) {}

// --- Bundles ---

export const createBundleSchema = z.object({
  titleAr: z.string().trim().min(2).max(200),
  lectureIds: z.array(objectId).min(1, 'الباقة يجب أن تحتوي على محاضرة واحدة على الأقل').max(100),
  priceMinorUnits: z.number().int().min(0),
  description: z.string().trim().max(3000).nullable().optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
});
export class CreateBundleDto extends createZodDto(createBundleSchema) {}
