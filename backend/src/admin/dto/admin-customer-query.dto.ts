import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const adminCustomerQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export class AdminCustomerQueryDto extends createZodDto(adminCustomerQuerySchema) {}
