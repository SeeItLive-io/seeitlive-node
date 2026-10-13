export type Env = "live" | "test";
export type InviteChannel = "sms" | "email" | "link";
export type GuestProtection = "none" | "password" | "totp";

export interface SeeItLiveConfig { apiKey?: string; oauthToken?: string; baseUrl?: string; env?: Env; signingSecret?: string; }
export interface CreateSessionParams { channel: InviteChannel; recipientPhone?: string; recipientEmail?: string; note?: string; ttlMinutes?: number; smsConsent?: boolean; metadata?: Record<string, string>; shortLink?: boolean; protection?: Exclude<GuestProtection, "none">; protectionSecret?: string; }
export interface Session { id: string; status: string; inviteCode: string; inviteUrl: string; inviteShortUrl: string | null; agentViewUrl: string; metadata?: Record<string, string> | null; expiresAt: string | null; protection?: GuestProtection; protectionSecret?: string | null; protectionOtpauthUrl?: string | null; }
export interface SessionStatus { id: string; status: string; startedAt: string | null; endedAt: string | null; producerCount: number; hasVideo: boolean; }
/** The agent's view of a session's guest challenge. For `totp` this carries the CURRENT code, never the seed. */
export interface ProtectionInfo { type: GuestProtection; password: string | null; code: string | null; secondsRemaining: number | null; locked: boolean; failedAttempts: number; }
/** Omit `protectionSecret` and the API generates one. `protection: "none"` clears the challenge and any lockout with it. */
export interface SetProtectionParams { protection: GuestProtection; protectionSecret?: string; }
/** A session's invitation as the agent side sees it — never the token hash or the guest secret. */
export interface SessionInvitation { code: string; channel: InviteChannel; recipient: string | null; expiresAt: string; openedAt: string | null; }
/** A stored session read back by id, unlike `Session` which is the create response. */
export interface SessionDetail { id: string; teamId: string; env: Env; status: string; createdByClientId: string | null; createdByApiKeyId: string | null; note: string | null; metadata: Record<string, string> | null; startedAt: string | null; endedAt: string | null; createdAt: string; invitation: SessionInvitation | null; }
/** Rotation is opt-in: a lockout is usually a mistyped secret, not a leaked one. */
export interface ResetProtectionParams { rotate?: boolean; }
/** Options for reviving (or replacing) an expired invitation. */
export interface ReshareParams {
  /** "revive" extends the existing link in place; "new" issues a fresh one and kills the old. */
  mode?: "revive" | "new";
  /** Change how the customer is reached. Omit to reuse the recorded channel. */
  channel?: InviteChannel;
  /** Change the phone number or email address. Omit to reuse the recorded one. */
  recipient?: string;
  /** Required and must be true when `channel` is "sms". */
  smsConsent?: boolean;
}
/** Reports how a revived invitation was (or wasn't) delivered. */
export interface ReshareResult {
  expiresAt: string;
  /** Null when the session has no short link — it can be extended but not re-sent. */
  inviteShortUrl: string | null;
  resend: "sent" | "suppressed" | "unavailable" | "not_requested";
  /** True when a new code/link was issued (mode: "new"). */
  rotated: boolean;
}
/** Labels the viewer in the dashboard's list (e.g. "Odoo — crm.lead 42"). */
export interface CreateAgentTokenParams { label?: string; }
export interface AgentToken { code: string; token: string; agentViewUrl: string; }
export interface SnapshotSummary { id: string; width: number | null; height: number | null; capturedAt: string; url: string; }
/** `data` is the base64-encoded PNG. */
export interface SnapshotImage { id: string; contentType: string; width: number | null; height: number | null; capturedAt: string; data: string; }
export interface Plan { planKey: string; planName: string; sessionLimit: number | null; seatLimit: number | null; concurrentLimit: number | null; }
export interface TokenInfo { valid: boolean; clientId: string; teamId: string; scopes: string[]; plan: Plan; expiresAt: string | null; }
export interface ExchangeCodeParams { code: string; clientId: string; clientSecret: string; redirectUri: string; codeVerifier?: string; baseUrl?: string; }
export interface TokenResponse { accessToken: string; tokenType: string; clientId: string; teamId: string; scopes: string[]; plan: Plan; }
