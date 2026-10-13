import type { HttpClient } from "../http.js";
import type { Plan, TokenInfo } from "../types.js";

interface RawTokenInfo { valid: boolean; client_id: string; team_id: string; scopes: string[]; plan: Plan; expires_at: string | null; }

export class OAuth {
  constructor(private readonly http: HttpClient) {}
  async verify(): Promise<TokenInfo> {
    const r = await this.http.request<RawTokenInfo>("/oauth/verify");
    return { valid: r.valid, clientId: r.client_id, teamId: r.team_id, scopes: r.scopes, plan: r.plan, expiresAt: r.expires_at };
  }
}
