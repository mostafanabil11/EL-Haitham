export interface JwtPayload {
  sub: string;
  // Phone, not email: students on this platform have no email address, so it
  // is the only identifier guaranteed to be present on every account.
  phone: string;
  role: string;
  type?: 'access' | 'refresh';
}
