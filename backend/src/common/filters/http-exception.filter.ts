import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

const FALLBACK_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'We couldn\'t process that request. Please check your input and try again.',
  [HttpStatus.UNAUTHORIZED]: 'Please sign in to continue.',
  [HttpStatus.FORBIDDEN]: 'You don\'t have permission to do that.',
  [HttpStatus.NOT_FOUND]: 'We couldn\'t find what you were looking for.',
  [HttpStatus.CONFLICT]: 'This conflicts with something that already exists.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Please slow down and try again shortly.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Something went wrong on our end. Please try again shortly.',
};

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isMongoDuplicateKeyError(exception: unknown): exception is MongoDuplicateKeyError {
  return (
    exception instanceof Error &&
    exception.name === 'MongoServerError' &&
    (exception as MongoDuplicateKeyError).code === 11000
  );
}

interface ZodIssueLike {
  path?: unknown;
  message?: unknown;
}

// Reduces a thrown exception's `getResponse()` payload down to client-safe
// validation details. nestjs-zod's ZodValidationException ships the raw Zod
// issue objects under `errors` — which include internals like regex
// `pattern` and `origin`/`code` that have no business reaching a client —
// so those get flattened to plain { field, message } pairs. Our own
// hand-built errors (e.g. the local ZodValidationPipe) already use a plain
// `error` key and pass through untouched.
function extractErrorDetails(res: Record<string, unknown>): unknown {
  if (Array.isArray(res.errors)) {
    return (res.errors as ZodIssueLike[]).map((issue) => ({
      field: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path ?? ''),
      message: typeof issue.message === 'string' ? issue.message : 'Invalid value',
    }));
  }
  if ('error' in res && res.error !== undefined) {
    return res.error;
  }
  return null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = FALLBACK_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR]!;
    let errorDetails: unknown = null;

    if (exception instanceof HttpException) {
      // Thrown deliberately by our own code (or the Zod validation pipe) —
      // the message and any structured `error` payload are already meant
      // for the client, safe to pass through as-is.
      status = exception.getStatus();
      const res = exception.getResponse();

      if (exception.constructor.name === 'ThrottlerException') {
        // Nest's built-in message is the bare exception name ("ThrottlerException:
        // Too Many Requests") — not something meant for a client to read.
        message = FALLBACK_MESSAGES[status]!;
      } else if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || FALLBACK_MESSAGES[status] || message;
        errorDetails = extractErrorDetails(resObj);
      }
    } else if (isMongoDuplicateKeyError(exception)) {
      status = HttpStatus.CONFLICT;
      const field = exception.keyPattern ? Object.keys(exception.keyPattern)[0] : null;
      message = field
        ? `This ${field} is already in use. Please use a different value.`
        : FALLBACK_MESSAGES[HttpStatus.CONFLICT]!;
      this.logger.warn(`Duplicate key on ${request.method} ${request.url}: ${exception.message}`);
    } else {
      // Anything unhandled — a driver error, a bug, a third-party throw.
      // Never forward its raw .message to the client: it can contain stack
      // fragments, connection strings, or schema/field names. Log the real
      // thing server-side under a correlation id the client can quote back.
      const requestId = randomUUID();
      const rawMessage = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(`[${requestId}] Unhandled exception on ${request.method} ${request.url}: ${rawMessage}`, stack);

      message = isProduction
        ? `${FALLBACK_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR]} (ref: ${requestId})`
        : rawMessage;
      errorDetails = isProduction ? null : { requestId, stack };
    }

    response.status(status).json({
      success: false,
      message,
      error: errorDetails,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
