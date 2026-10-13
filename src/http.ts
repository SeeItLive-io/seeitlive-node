import { SeeItLiveError, ValidationError, AuthenticationError, PermissionError, NotFoundError, RateLimitError } from "./errors.js";
import { signRequest } from "./signing.js";

export class HttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly authHeader: string,
    private readonly signingSecret?: string,
  ) {}

  async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const { method = "GET", body } = options;
    const headers: Record<string, string> = {};
    if (this.authHeader) headers["Authorization"] = this.authHeader;
    const serializedBody = body === undefined ? undefined : JSON.stringify(body);
    if (serializedBody !== undefined) headers["Content-Type"] = "application/json";
    if (this.signingSecret) {
      Object.assign(
        headers,
        signRequest(this.signingSecret, method, path, serializedBody, Math.floor(Date.now() / 1000)),
      );
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method, headers, body: serializedBody,
    });
    if (!res.ok) await this.handleError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async handleError(res: Response): Promise<never> {
    let body: { message?: string; code?: string; field?: string } = {};
    try { body = (await res.json()) as typeof body; } catch { /* non-JSON error */ }
    const message = body.message || `HTTP ${res.status}`;
    const code = body.code;
    switch (res.status) {
      case 400: throw new ValidationError(message, body.field, code);
      case 401: throw new AuthenticationError(message, code);
      case 403: throw new PermissionError(message, code);
      case 404: throw new NotFoundError(message, code);
      case 429: {
        const parsed = parseInt(res.headers.get("Retry-After") ?? "", 10);
        const retryAfter = Number.isNaN(parsed) ? undefined : parsed; // preserve a legit 0 (retry now)
        throw new RateLimitError(message, retryAfter, code);
      }
      default: throw new SeeItLiveError(res.status, message, code);
    }
  }
}
