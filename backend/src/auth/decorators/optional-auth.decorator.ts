import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Authenticate if a token is present, but don't reject the request if it
 * isn't. `request.user` is the usual RequestUser when signed in and `null`
 * otherwise, so the handler decides what an anonymous caller may do.
 *
 * Distinct from `@Public()`, which skips Passport entirely and therefore
 * leaves `request.user` unset even for a caller holding a perfectly valid
 * token — no good for a route like the lecture page, which must serve an
 * anonymous visitor and an enrolled student from the same handler.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
