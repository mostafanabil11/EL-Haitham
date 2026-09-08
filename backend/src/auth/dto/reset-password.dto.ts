import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required' }),
  newPassword: z
    .string()
    .min(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    .max(128),
});

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
