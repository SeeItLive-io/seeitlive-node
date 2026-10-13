import type { HttpClient } from "../http.js";
import type {
  AgentToken,
  CreateAgentTokenParams,
  CreateSessionParams,
  ProtectionInfo,
  ResetProtectionParams,
  ReshareParams,
  ReshareResult,
  Session,
  SessionDetail,
  SessionStatus,
  SetProtectionParams,
} from "../types.js";

export class Sessions {
  constructor(private readonly http: HttpClient) {}
  create(params: CreateSessionParams): Promise<Session> {
    return this.http.request<Session>("/sessions", { method: "POST", body: params });
  }
  /** Read a stored session, including how its invitation was delivered. */
  get(id: string): Promise<SessionDetail> {
    return this.http.request<SessionDetail>(`/sessions/${encodeURIComponent(id)}`);
  }
  status(id: string): Promise<SessionStatus> {
    return this.http.request<SessionStatus>(`/sessions/${encodeURIComponent(id)}/status`);
  }
  /** The secret to read to the customer: the password, or the rotating code of the moment. */
  getProtection(id: string): Promise<ProtectionInfo> {
    return this.http.request<ProtectionInfo>(`/sessions/${encodeURIComponent(id)}/protection`);
  }
  /**
   * Change a session's guest challenge after creation. Omit `protectionSecret`
   * and one is generated. `protection: "none"` clears the challenge, and any
   * lockout with it.
   */
  setProtection(id: string, params: SetProtectionParams): Promise<ProtectionInfo> {
    // Build the body explicitly rather than spreading params: an explicit
    // `protectionSecret: undefined` key would serialize away anyway, but being
    // deliberate here keeps "absent means generate one" unambiguous.
    const body: SetProtectionParams = { protection: params.protection };
    if (params.protectionSecret !== undefined) body.protectionSecret = params.protectionSecret;
    return this.http.request<ProtectionInfo>(`/sessions/${encodeURIComponent(id)}/protection`, {
      method: "PUT",
      body,
    });
  }

  /**
   * Clear a guest lockout. Rotation is opt-in: the usual cause is the customer
   * mistyping, and a new secret would just make the agent read it out again.
   */
  resetProtection(id: string, params: ResetProtectionParams = {}): Promise<ProtectionInfo> {
    const body: ResetProtectionParams = {};
    if (params.rotate !== undefined) body.rotate = params.rotate;
    return this.http.request<ProtectionInfo>(
      `/sessions/${encodeURIComponent(id)}/protection/reset`,
      { method: "POST", body },
    );
  }
  /**
   * Mint a fresh agent-view token so an embedded viewer can watch the session.
   * Tokens expire after 120 minutes; call this again to re-open a viewer.
   */
  createAgentToken(id: string, params: CreateAgentTokenParams = {}): Promise<AgentToken> {
    const body: CreateAgentTokenParams = {};
    if (params.label !== undefined) body.label = params.label;
    return this.http.request<AgentToken>(`/sessions/${encodeURIComponent(id)}/agent-token`, {
      method: "POST",
      body,
    });
  }

  /**
   * Revive an expired invitation. `mode: "revive"` (the default) extends the
   * SAME link and code in place, so a message the customer already has starts
   * working again; `mode: "new"` issues a fresh link and kills the old one.
   *
   * A session created without a short link can be extended but not re-sent —
   * the plaintext token survives only in the short link's encrypted fragment.
   * `resend` reports which happened.
   */
  reshare(id: string, params: ReshareParams = {}): Promise<ReshareResult> {
    // Built explicitly rather than spread, so "absent means reuse what was
    // recorded" stays unambiguous.
    const body: ReshareParams = {};
    if (params.mode !== undefined) body.mode = params.mode;
    if (params.channel !== undefined) body.channel = params.channel;
    if (params.recipient !== undefined) body.recipient = params.recipient;
    if (params.smsConsent !== undefined) body.smsConsent = params.smsConsent;
    return this.http.request<ReshareResult>(`/sessions/${encodeURIComponent(id)}/reshare`, {
      method: "POST",
      body,
    });
  }

}
