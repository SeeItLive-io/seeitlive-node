export class SeeItLiveError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "SeeItLiveError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
export class ValidationError extends SeeItLiveError {
  readonly field?: string;
  constructor(message: string, field?: string, code?: string) { super(400, message, code); this.name = "ValidationError"; this.field = field; }
}
export class AuthenticationError extends SeeItLiveError {
  constructor(message = "Authentication failed", code?: string) { super(401, message, code); this.name = "AuthenticationError"; }
}
export class PermissionError extends SeeItLiveError {
  constructor(message = "Forbidden", code?: string) { super(403, message, code); this.name = "PermissionError"; }
}
export class NotFoundError extends SeeItLiveError {
  constructor(message = "Not found", code?: string) { super(404, message, code); this.name = "NotFoundError"; }
}
export class RateLimitError extends SeeItLiveError {
  readonly retryAfter?: number;
  constructor(message = "Rate limited", retryAfter?: number, code?: string) { super(429, message, code); this.name = "RateLimitError"; this.retryAfter = retryAfter; }
}
