import { Global, Module } from '@nestjs/common';
import { AuditInterceptor } from './interceptors/audit.interceptor';

// Global so any feature controller can `@UseInterceptors(AuditInterceptor)`
// without importing this module directly — it only depends on Reflector
// (always available) and EventEmitter2 (global via EventEmitterModule).
@Global()
@Module({
  providers: [AuditInterceptor],
  exports: [AuditInterceptor],
})
export class CommonModule {}
