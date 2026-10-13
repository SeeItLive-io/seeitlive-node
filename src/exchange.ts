import { HttpClient } from "./http.js";
import type { ExchangeCodeParams, Plan, TokenResponse } from "./types.js";

interface RawTokenResponse { access_token: string; token_type: string; client_id: string; team_id: string; scopes: string[]; plan: Plan; }
const DEFAULT_BASE_URL = "https://api.seeitlive.io/v1";

export async function exchangeCode(params: ExchangeCodeParams): Promise<TokenResponse> {
  const baseUrl = (params.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const http = new HttpClient(baseUrl, ""); // no bearer — confidential client via body
  const r = await http.request<RawTokenResponse>("/oauth/token", {
    method: "POST",
    body: {
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
    },
  });
  return { accessToken: r.access_token, tokenType: r.token_type, clientId: r.client_id, teamId: r.team_id, scopes: r.scopes, plan: r.plan };
}
