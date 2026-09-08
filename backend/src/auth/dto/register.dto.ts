import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { GRADES } from '@/common/constants/grades';
import { normalizeEgyptianPhone } from '@/common/utils/phone.util';

// Accepts 01xxxxxxxxx, 201xxxxxxxxx or +20 1xx xxx xxxx and stores the
// canonical 201xxxxxxxxx form, so the same person cannot end up with two
// accounts by typing their number differently on two occasions.
const egyptianPhone = z
  .string()
  .transform((value) => normalizeEgyptianPhone(value))
  .refine((value): value is string => value !== null, {
    message: 'رقم الهاتف غير صحيح — أدخل رقماً مصرياً مثل 01012345678',
  });

export const registerSchema = z.object({
  name: z.string().trim().min(3, { message: 'الاسم مطلوب' }).max(120),
  phone: egyptianPhone,
  parentPhone: egyptianPhone,
  grade: z.enum(GRADES, { message: 'اختر الصف الدراسي' }),
  // The incumbent allows 6 characters. 8 is the floor here.
  password: z
    .string()
    .min(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    .max(128),
  // Optional, and the only route a student has to reset their own password.
  // Without one, a reset goes through the teacher.
  email: z.email().optional(),
});

export class RegisterDto extends createZodDto(registerSchema) {}
