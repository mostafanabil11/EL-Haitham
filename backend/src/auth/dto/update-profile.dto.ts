import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { GRADES } from '@/common/constants/grades';
import { normalizeEgyptianPhone } from '@/common/utils/phone.util';

// A student may fix their name, their parent's number or their grade. The
// login phone is deliberately NOT editable here — changing the identifier
// an account is found by is a support action, not a self-service one.
export const updateProfileSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  parentPhone: z
    .string()
    .transform((value) => normalizeEgyptianPhone(value))
    .refine((value): value is string => value !== null, { message: 'رقم ولي الأمر غير صحيح' })
    .optional(),
  grade: z.enum(GRADES).optional(),
  email: z.email().nullable().optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
