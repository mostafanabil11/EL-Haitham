import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
    .max(128),
});

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
