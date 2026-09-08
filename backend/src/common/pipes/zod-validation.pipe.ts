import { Injectable, ArgumentMetadata, PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema<any>) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' && metadata.type !== 'query' && metadata.type !== 'param') {
      return value;
    }

    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error: any) {
      if (error instanceof ZodError) {
        const zodError = error as any;
        const errors = zodError.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new BadRequestException({ message: 'Validation failed', error: errors });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
