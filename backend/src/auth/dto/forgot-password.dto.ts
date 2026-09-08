import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const forgotPasswordSchema = z.object({
  email: z.email({ message: 'Please provide a valid email address' }),
});

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
