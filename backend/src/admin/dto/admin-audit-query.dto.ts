import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const adminAuditQuerySchema = z.object({
  action: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export class AdminAuditQueryDto extends createZodDto(adminAuditQuerySchema) {}
