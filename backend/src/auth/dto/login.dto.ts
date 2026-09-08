import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { normalizeEgyptianPhone } from '@/common/utils/phone.util';

export const loginSchema = z.object({
  // Normalized the same way as registration, so a student who signed up
  // typing 01044175784 can sign in typing +201044175784 and vice versa.
  phone: z
    .string()
    .transform((value) => normalizeEgyptianPhone(value))
    .refine((value): value is string => value !== null, {
      message: 'رقم الهاتف غير صحيح',
    }),
  password: z.string().min(1, { message: 'كلمة المرور مطلوبة' }),
});

export class LoginDto extends createZodDto(loginSchema) {}
