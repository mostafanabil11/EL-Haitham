import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// The teacher resetting a student's password by hand. This is the ONLY reset
// path for the typical student, who registers with a phone and no email: they
// message him on WhatsApp, he sets a new password and tells them what it is.
export const adminResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    .max(128),
});

export class AdminResetPasswordDto extends createZodDto(adminResetPasswordSchema) {}
