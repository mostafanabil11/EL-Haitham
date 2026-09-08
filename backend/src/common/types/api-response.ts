// Mongoose's `.lean()` produces a structural type so large that TypeScript
// refuses to serialize it into a declaration file (TS7056), and any handler
// returning one straight out needs an explicit annotation. Naming the envelope
// once is better than sprinkling `: Promise<any>` at each call site, and it
// documents the response shape every controller in this codebase returns.
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
