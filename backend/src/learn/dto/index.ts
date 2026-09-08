import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const recordProgressSchema = z.object({
  itemId: z.string().length(24),
  positionSeconds: z.number().int().min(0).max(60 * 60 * 12),
});

export class RecordProgressDto extends createZodDto(recordProgressSchema) {}
