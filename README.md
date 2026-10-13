# @seeitlive/sdk

Official SeeItLive SDK for Node.js — the reference client for the SeeItLive API.

## Install

```bash
npm install @seeitlive/sdk
```

## Quick start

```ts
import { SeeItLive } from "@seeitlive/sdk";

const client = new SeeItLive({ apiKey: process.env.SEEITLIVE_API_KEY! });

// SMS channel requires recipientPhone + smsConsent (the recipient agreed
// to receive a text; carrier fees may apply)
const session = await client.sessions.create({
  channel: "sms",
  recipientPhone: "+15551234567",
  smsConsent: true,
});
console.log(session.inviteUrl, session.inviteCode);

// email channel requires recipientEmail
await client.sessions.create({
  channel: "email",
  recipientEmail: "customer@example.com",
});

// link channel needs neither — just returns a shareable link
const linkSession = await client.sessions.create({ channel: "link" });

const status = await client.sessions.status(session.id);
console.log(status.status, status.producerCount, status.hasVideo);
```

### Reading a session

`sessions.get` returns a stored session, including how its invitation was
delivered — useful when re-opening a session an integration created earlier:

```ts
const s = await client.sessions.get(session.id);
console.log(s.status, s.metadata, s.invitation?.channel, s.invitation?.recipient);
```

### Guest protection

A session can require the customer to enter a secret before their camera is
shared — a static password, or a rotating code. Read the current one to them:

```ts
const p = await client.sessions.getProtection(session.id);
if (p.type === "password") console.log(p.password);
if (p.type === "totp") console.log(p.code, `${p.secondsRemaining}s left`);
```

Change it after the session was created — including adding one to a session
that had none:

```ts
// Omit protectionSecret and one is generated for you.
const added = await client.sessions.setProtection(session.id, {
  protection: "password",
});
console.log(added.password); // read this to the customer

// Clearing also clears any lockout the customer triggered.
await client.sessions.setProtection(session.id, { protection: "none" });
```

Five wrong answers lock the guest out. Clear the lockout — rotation is opt-in,
since the usual cause is a mistyped secret:

```ts
await client.sessions.resetProtection(session.id);
const fresh = await client.sessions.resetProtection(session.id, { rotate: true });
```

For `totp`, `getProtection` returns the **current code**, never the seed — the
seed leaves the server only once, in the create response.

The client infers `env` (`"live"` or `"test"`) from the API key's prefix
(`sil_test_...` → `"test"`, otherwise `"live"`). You can override this with
the `env` option, and override the API base URL with `baseUrl` (default:
`https://api.seeitlive.io/v1`).

Provide **exactly one** of `apiKey` or `oauthToken` — passing both, or
neither, throws.

### Embedded viewer tokens

`sessions.createAgentToken` mints a fresh agent-view grant so your own UI can
embed the live viewer. Tokens expire after 120 minutes — mint another to
re-open a viewer:

```ts
const viewer = await client.sessions.createAgentToken(session.id, {
  label: "Odoo — crm.lead 42", // shown in the dashboard's viewer list
});
console.log(viewer.agentViewUrl);
```

### Snapshots

Frames the agent captured during a session. Both calls require a plan with
snapshot history:

```ts
const snapshots = await client.snapshots.list(session.id); // newest first
const image = await client.snapshots.get(snapshots[0].id);
// `data` is base64 PNG — the endpoint's raw-bytes mode is not used by the SDK
fs.writeFileSync("frame.png", Buffer.from(image.data, "base64"));
```

## OAuth usage

For OAuth-based (multi-tenant / marketplace) integrations, exchange an
authorization code for an access token using the standalone `exchangeCode`
function (this call is unauthenticated — it uses your client credentials in
the request body, not a bearer token):

```ts
import { exchangeCode, SeeItLive } from "@seeitlive/sdk";

const token = await exchangeCode({
  code: authorizationCodeFromRedirect,
  clientId: process.env.SEEITLIVE_CLIENT_ID!,
  clientSecret: process.env.SEEITLIVE_CLIENT_SECRET!,
  redirectUri: "https://your-app.example.com/oauth/callback",
});

const client = new SeeItLive({ oauthToken: token.accessToken });

const info = await client.oauth.verify();
console.log(info.clientId, info.teamId, info.scopes, info.plan);
```

## Request signing

Set `signingSecret` in the client config to have every outgoing request
HMAC-signed automatically:

```ts
const client = new SeeItLive({
  apiKey: process.env.SEEITLIVE_API_KEY,
  signingSecret: process.env.SEEITLIVE_SIGNING_SECRET,
});
```

When set, each request carries:

- `X-SeeItLive-Signature: sha256=<hex>` —
  `HMAC_SHA256(signingSecret, "<unix_ts>.<METHOD>.<path>.<sha256hex(raw_body)>")`,
  where `path` is the request path only (e.g. `/sessions`, no base URL and no
  `/api/v1` prefix) and `raw_body` is the exact bytes sent (hashed as the empty
  string when there is no body).
- `X-SeeItLive-Timestamp: <unix_ts>` — unix seconds.

`path` is signed **including any query string** the SDK sends (e.g.
`/snapshots/<id>?format=base64`) — the server verifies path *and* query,
so the two must match exactly.

A present-but-empty string is treated the same as an absent secret: requests
are unsigned by default, so this is fully backwards-compatible. The OAuth
`exchangeCode` call is never signed.

## Errors

All SDK errors extend `SeeItLiveError` (`statusCode`, `message`, `code`):

| Class | HTTP status |
| --- | --- |
| `ValidationError` (also has `field`) | 400 |
| `AuthenticationError` | 401 |
| `PermissionError` | 403 |
| `NotFoundError` | 404 |
| `RateLimitError` (also has `retryAfter`, seconds) | 429 |
| `SeeItLiveError` | any other non-2xx status |

```ts
import { SeeItLiveError, RateLimitError } from "@seeitlive/sdk";

try {
  await client.sessions.status("missing");
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log("retry after", err.retryAfter, "seconds");
  } else if (err instanceof SeeItLiveError) {
    console.error(err.statusCode, err.message, err.code);
  } else {
    throw err;
  }
}
```

## Live validation

`scripts/validate.mjs` drives the **built** SDK artifact (`dist/index.js`,
not `src/`) against a real running SeeItLive API and asserts the responses
match the SDK's TypeScript contract — construction, `sessions.create`,
`sessions.status`, the 404 → `NotFoundError` error mapping, and (optionally)
`oauth.verify()`. It has no dependencies beyond the SDK and Node builtins,
and exits non-zero if any check fails.

```bash
npm run build   # produces dist/ — the script imports the built output

SEEITLIVE_BASE_URL=http://localhost:3101/api/v1 \
SEEITLIVE_API_KEY=sil_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
node scripts/validate.mjs
```

Env vars:

- `SEEITLIVE_BASE_URL` (required) — must include the API version segment,
  e.g. `http://localhost:3101/api/v1`.
- `SEEITLIVE_API_KEY` (required) — a real `sil_test_...` or `sil_live_...`
  key for a non-suspended team with session quota remaining.
- `SEEITLIVE_OAUTH_TOKEN` (optional) — when set, also validates
  `oauth.verify()` against a real OAuth access token.

## Security

- **Never log API keys, OAuth access tokens, or refresh tokens.**
- **Never ship `clientSecret` to the browser.** `exchangeCode` must only be
  called from a trusted server-side context — it is a confidential-client
  operation. Client-side code should redirect the user through your own
  backend, which performs the code exchange and hands the browser a
  short-lived session, never the raw OAuth token or client secret.
