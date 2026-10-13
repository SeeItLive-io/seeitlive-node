import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SeeItLive, exchangeCode,
  AuthenticationError, RateLimitError, NotFoundError, ValidationError,
} from "./index.js";
import { signRequest } from "./signing.js";

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async () =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status, headers: { "content-type": "application/json", ...headers },
    }),
  );
}
const KEY = "sil_live_" + "a".repeat(32);

describe("SeeItLive", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("infers env from prefix and enforces exactly-one credential", () => {
    expect(new SeeItLive({ apiKey: "sil_test_" + "a".repeat(32) }).env).toBe("test");
    expect(new SeeItLive({ apiKey: KEY }).env).toBe("live");
    expect(() => new SeeItLive({} as any)).toThrow();
    expect(() => new SeeItLive({ apiKey: KEY, oauthToken: "x" } as any)).toThrow();
    // Empty string counts as "not provided" (symmetric): blank apiKey must throw,
    // and a blank apiKey alongside a real oauthToken falls through to the token.
    expect(() => new SeeItLive({ apiKey: "" } as any)).toThrow();
    expect(new SeeItLive({ apiKey: "", oauthToken: "sil_live_oauth_" + "a".repeat(40) } as any).env).toBe("live");
  });

  it("sessions.create POSTs /sessions with bearer + json body and parses camelCase", async () => {
    const f = mockFetch(200, { id: "s1", status: "pending", inviteCode: "abc", inviteUrl: "u", inviteShortUrl: "https://sitl.cc/s/aB3xK9", agentViewUrl: "a", expiresAt: "2026-01-01T00:00:00Z" });
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY, baseUrl: "https://api.example.com/v1" });
    const res = await c.sessions.create({ channel: "link" });
    expect(res.inviteCode).toBe("abc");
    expect(res.inviteShortUrl).toBe("https://sitl.cc/s/aB3xK9");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/sessions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body as string)).toEqual({ channel: "link" });
  });

  it("signs requests when signingSecret is configured, and omits signature headers otherwise", async () => {
    const f = mockFetch(200, { id: "s1", status: "pending", inviteCode: "abc", inviteUrl: "u", inviteShortUrl: "https://sitl.cc/s/aB3xK9", agentViewUrl: "a", expiresAt: "2026-01-01T00:00:00Z" });
    vi.stubGlobal("fetch", f);
    const signed = new SeeItLive({ apiKey: KEY, signingSecret: "wh_secret_" + "b".repeat(32) });
    await signed.sessions.create({ channel: "link" });
    const [, signedInit] = f.mock.calls[0] as [string, RequestInit];
    const signedHeaders = signedInit.headers as Record<string, string>;
    expect(signedHeaders["X-SeeItLive-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signedHeaders["X-SeeItLive-Timestamp"]).toMatch(/^\d+$/);

    const f2 = mockFetch(200, { id: "s1", status: "pending", inviteCode: "abc", inviteUrl: "u", inviteShortUrl: "https://sitl.cc/s/aB3xK9", agentViewUrl: "a", expiresAt: "2026-01-01T00:00:00Z" });
    vi.stubGlobal("fetch", f2);
    const unsigned = new SeeItLive({ apiKey: KEY });
    await unsigned.sessions.create({ channel: "link" });
    const [, unsignedInit] = f2.mock.calls[0] as [string, RequestInit];
    const unsignedHeaders = unsignedInit.headers as Record<string, string>;
    expect(unsignedHeaders["X-SeeItLive-Signature"]).toBeUndefined();
    expect(unsignedHeaders["X-SeeItLive-Timestamp"]).toBeUndefined();
  });

  it("sessions.status GETs /sessions/:id/status", async () => {
    const f = mockFetch(200, { id: "s1", status: "live", startedAt: "t", endedAt: null, producerCount: 1, hasVideo: true });
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    const res = await c.sessions.status("s1");
    expect(res.producerCount).toBe(1);
    expect(res.hasVideo).toBe(true);
    expect((f.mock.calls[0] as [string])[0]).toBe("https://api.seeitlive.io/v1/sessions/s1/status");
  });

  const PROTECTION = {
    type: "password", password: "K7QMX2RT", code: null,
    secondsRemaining: null, locked: false, failedAttempts: 0,
  };

  it("sessions.getProtection GETs /sessions/:id/protection", async () => {
    const f = mockFetch(200, PROTECTION);
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    const res = await c.sessions.getProtection("s1");
    expect(res.type).toBe("password");
    expect(res.password).toBe("K7QMX2RT");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.seeitlive.io/v1/sessions/s1/protection");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("sessions.setProtection PUTs /sessions/:id/protection", async () => {
    const f = mockFetch(200, PROTECTION);
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    const res = await c.sessions.setProtection("s1", {
      protection: "password", protectionSecret: "K7QMX2RT",
    });
    expect(res.password).toBe("K7QMX2RT");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.seeitlive.io/v1/sessions/s1/protection");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(init.body as string)).toEqual({
      protection: "password", protectionSecret: "K7QMX2RT",
    });
  });

  it("sessions.setProtection omits protectionSecret when not supplied", async () => {
    const f = mockFetch(200, PROTECTION);
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    await c.sessions.setProtection("s1", { protection: "password" });
    const [, init] = f.mock.calls[0] as [string, RequestInit];
    // Not `{"protectionSecret": undefined}` and not null — the API generates a
    // secret only when the field is absent.
    expect(JSON.parse(init.body as string)).toEqual({ protection: "password" });
  });

  it("sessions.setProtection signs the PUT when signingSecret is configured", async () => {
    const f = mockFetch(200, PROTECTION);
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY, signingSecret: "wh_secret_" + "b".repeat(32) });
    await c.sessions.setProtection("s1", { protection: "none" });
    const [, init] = f.mock.calls[0] as [string, RequestInit];
    const h = init.headers as Record<string, string>;
    expect(h["X-SeeItLive-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(h["X-SeeItLive-Timestamp"]).toMatch(/^\d+$/);
  });

  it("sessions.getProtection encodes the id into the path", async () => {
    const f = mockFetch(200, PROTECTION);
    vi.stubGlobal("fetch", f);
    await new SeeItLive({ apiKey: KEY }).sessions.getProtection("a/b");
    expect((f.mock.calls[0] as [string])[0]).toBe(
      "https://api.seeitlive.io/v1/sessions/a%2Fb/protection",
    );
  });

  it("oauth.verify maps snake_case wire fields to camelCase", async () => {
    const plan = { planKey: "free", planName: "Free", sessionLimit: null, seatLimit: null, concurrentLimit: null };
    vi.stubGlobal("fetch", mockFetch(200, { valid: true, client_id: "c", team_id: "p", scopes: ["sessions:write"], plan, expires_at: "2026-01-01" }));
    const c = new SeeItLive({ oauthToken: "sil_live_oauth_" + "a".repeat(40) });
    const info = await c.oauth.verify();
    expect(info.clientId).toBe("c");
    expect(info.teamId).toBe("p");
    expect(info.scopes).toContain("sessions:write");
  });

  it("maps HTTP status codes to typed errors", async () => {
    for (const [status, Err] of [[401, AuthenticationError], [404, NotFoundError], [400, ValidationError]] as const) {
      vi.stubGlobal("fetch", mockFetch(status, { message: "x" }));
      await expect(new SeeItLive({ apiKey: KEY }).sessions.status("s")).rejects.toBeInstanceOf(Err);
    }
    vi.stubGlobal("fetch", mockFetch(429, { message: "slow" }, { "Retry-After": "12" }));
    await expect(new SeeItLive({ apiKey: KEY }).sessions.status("s")).rejects.toMatchObject({ retryAfter: 12 });
  });

  it("exchangeCode POSTs /oauth/token WITHOUT bearer and maps the token", async () => {
    const plan = { planKey: "free", planName: "Free", sessionLimit: null, seatLimit: null, concurrentLimit: null };
    const f = mockFetch(200, { access_token: "sil_live_oauth_x", token_type: "Bearer", client_id: "c", team_id: "p", scopes: [], plan });
    vi.stubGlobal("fetch", f);
    const tok = await exchangeCode({ code: "code123", clientId: "c", clientSecret: "s", redirectUri: "https://x/cb", baseUrl: "https://api.example.com/v1" });
    expect(tok.accessToken).toBe("sil_live_oauth_x");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/oauth/token");
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
    expect(JSON.parse(init.body as string).grant_type).toBe("authorization_code");
  });

  it("sessions.get GETs /sessions/:id and returns the session with its invitation", async () => {
    const f = mockFetch(200, {
      id: "s1", teamId: "t1", env: "live", status: "active", note: null, metadata: { ticket: "42" },
      startedAt: "2026-01-01T00:00:00Z", endedAt: null, createdAt: "2026-01-01T00:00:00Z",
      invitation: { code: "abc123", expiresAt: "2026-01-01T01:00:00Z", openedAt: null, channel: "sms", recipient: "+15145551234" },
    });
    vi.stubGlobal("fetch", f);
    const res = await new SeeItLive({ apiKey: KEY }).sessions.get("s1");
    expect(res.teamId).toBe("t1");
    expect(res.invitation?.code).toBe("abc123");
    expect(res.invitation?.channel).toBe("sms");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.seeitlive.io/v1/sessions/s1");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("sessions.resetProtection POSTs /sessions/:id/protection/reset, rotating only when asked", async () => {
    const info = { type: "password", password: "K7QMX2RT", code: null, secondsRemaining: null, locked: false, failedAttempts: 0 };
    const f = mockFetch(200, info);
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    const res = await c.sessions.resetProtection("s1", { rotate: true });
    expect(res.locked).toBe(false);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.seeitlive.io/v1/sessions/s1/protection/reset");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ rotate: true });

    // Clearing a lockout is the common case, and it must not rotate by accident.
    const f2 = mockFetch(200, info);
    vi.stubGlobal("fetch", f2);
    await c.sessions.resetProtection("s1");
    expect(JSON.parse((f2.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({});
  });

  it("sessions.createAgentToken POSTs /sessions/:id/agent-token with an optional label", async () => {
    const f = mockFetch(200, { code: "vw1", token: "tok", agentViewUrl: "https://app.seeitlive.io/v/vw1#tok" });
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    const res = await c.sessions.createAgentToken("s1", { label: "Odoo — crm.lead 42" });
    expect(res.agentViewUrl).toBe("https://app.seeitlive.io/v/vw1#tok");
    expect(res.token).toBe("tok");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.seeitlive.io/v1/sessions/s1/agent-token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ label: "Odoo — crm.lead 42" });

    const f2 = mockFetch(200, { code: "vw1", token: "tok", agentViewUrl: "u" });
    vi.stubGlobal("fetch", f2);
    await c.sessions.createAgentToken("s1");
    expect(JSON.parse((f2.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({});
  });

  it("sessions.reshare POSTs /sessions/:id/reshare and returns the result", async () => {
    const f = mockFetch(200, {
      expiresAt: "2026-01-02T00:00:00Z", inviteShortUrl: "https://sitl.cc/s/aB3xK9",
      resend: "sent", rotated: true,
    });
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    const res = await c.sessions.reshare("sess_123", {
      mode: "new", channel: "sms", recipient: "+15145550199", smsConsent: true,
    });
    expect(res.rotated).toBe(true);
    expect(res.resend).toBe("sent");
    expect(res.inviteShortUrl).toBe("https://sitl.cc/s/aB3xK9");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.seeitlive.io/v1/sessions/sess_123/reshare");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      mode: "new", channel: "sms", recipient: "+15145550199", smsConsent: true,
    });
  });

  it("sessions.reshare with no params sends an empty body (reuse what was recorded)", async () => {
    const f = mockFetch(200, {
      expiresAt: "2026-01-02T00:00:00Z", inviteShortUrl: null,
      resend: "not_requested", rotated: false,
    });
    vi.stubGlobal("fetch", f);
    const c = new SeeItLive({ apiKey: KEY });
    const res = await c.sessions.reshare("sess_123");
    expect(res.inviteShortUrl).toBeNull();
    const [, init] = f.mock.calls[0] as [string, RequestInit];
    // Not `{mode: undefined, channel: undefined, ...}` — absent fields must not
    // serialize at all, or the server would read them as an explicit instruction.
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it("sessions.reshare url-encodes the session id", async () => {
    const f = mockFetch(200, {
      expiresAt: "2026-01-02T00:00:00Z", inviteShortUrl: null,
      resend: "not_requested", rotated: false,
    });
    vi.stubGlobal("fetch", f);
    await new SeeItLive({ apiKey: KEY }).sessions.reshare("sess/../evil");
    expect((f.mock.calls[0] as [string])[0]).toBe(
      "https://api.seeitlive.io/v1/sessions/sess%2F..%2Fevil/reshare",
    );
  });

  it("snapshots.list GETs /sessions/:id/snapshots", async () => {
    const f = mockFetch(200, [{ id: "sn1", width: 1280, height: 720, capturedAt: "2026-01-01T00:00:00Z", url: "/api/v1/snapshots/sn1" }]);
    vi.stubGlobal("fetch", f);
    const res = await new SeeItLive({ apiKey: KEY }).snapshots.list("s1");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("sn1");
    expect(res[0].width).toBe(1280);
    expect((f.mock.calls[0] as [string])[0]).toBe("https://api.seeitlive.io/v1/sessions/s1/snapshots");
  });

  it("snapshots.get asks for base64 JSON rather than raw PNG bytes", async () => {
    const f = mockFetch(200, {
      id: "sn1", contentType: "image/png", width: 1280, height: 720,
      capturedAt: "2026-01-01T00:00:00Z", data: "aVZCT1J3MEs=",
    });
    vi.stubGlobal("fetch", f);
    const res = await new SeeItLive({ apiKey: KEY }).snapshots.get("sn1");
    expect(res.data).toBe("aVZCT1J3MEs=");
    expect(res.contentType).toBe("image/png");
    expect((f.mock.calls[0] as [string])[0]).toBe("https://api.seeitlive.io/v1/snapshots/sn1?format=base64");
  });

  it("signs the snapshot fetch over the path INCLUDING its query string", async () => {
    const f = mockFetch(200, { id: "sn1", contentType: "image/png", width: null, height: null, capturedAt: "2026-01-01T00:00:00Z", data: "" });
    vi.stubGlobal("fetch", f);
    const secret = "whsec_" + "b".repeat(32);
    await new SeeItLive({ apiKey: KEY, signingSecret: secret }).snapshots.get("sn1");
    const [, init] = f.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const ts = headers["X-SeeItLive-Timestamp"];
    // The server signs request.url (path+query) minus /api/v1, so a signature
    // computed over the bare path would authenticate on the client and fail there.
    const expected = signRequest(secret, "GET", "/snapshots/sn1?format=base64", undefined, Number(ts));
    expect(headers["X-SeeItLive-Signature"]).toBe(expected["X-SeeItLive-Signature"]);
  });

});
