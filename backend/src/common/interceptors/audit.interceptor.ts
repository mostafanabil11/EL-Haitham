import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';
import { RequestUser } from '@/auth/interfaces/request-user.interface';

// Applied at controller level across every admin-mutating controller; it's a
// no-op for any route that isn't also decorated with @Audit(...), so it's
// safe to leave on public/customer routes in the same controller. Emits
// rather than writing to the DB directly — AdminModule's listener owns
// persistence, the same event-driven separation 'order.placed' etc. use
// elsewhere — so this stays a generic, reusable piece with no dependency on
// the admin feature module.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private eventEmitter: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const action = this.reflector.get<string>(AUDIT_ACTION_KEY, context.getHandler());
    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;

    return next.handle().pipe(
      tap((result) => {
        // Logging failure must never surface as a request failure — the
        // mutation already succeeded by the time this runs.
        try {
          this.eventEmitter.emit('admin.mutation', {
            adminId: user?.userId ?? null,
            adminPhone: user?.phone ?? null,
            action,
            params: request.params,
            body: this.stripSensitive(request.body),
            resultSummary: this.summarize(result),
          });
        } catch {
          // ignore
        }
      }),
    );
  }

  private stripSensitive(body: unknown) {
    if (!body || typeof body !== 'object') return body;
    const { password, currentPassword, newPassword, ...rest } = body as Record<string, unknown>;
    return rest;
  }

  private summarize(result: unknown) {
    const data = (result as { data?: unknown } | undefined)?.data;
    if (!data) return null;
    if (Array.isArray(data)) return { count: data.length };
    const record = data as Record<string, unknown>;
    return { id: record._id ?? record.orderNumber ?? null };
  }
}
