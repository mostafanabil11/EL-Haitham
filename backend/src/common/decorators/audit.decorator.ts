import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'auditAction';

// Marks a route as an admin mutation worth logging. Paired with
// AuditInterceptor, which reads this metadata and — only when present —
// emits an 'admin.mutation' event after the handler succeeds.
export const Audit = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
