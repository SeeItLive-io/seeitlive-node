#!/usr/bin/env node
// Live end-to-end validation for the BUILT @seeitlive/sdk artifact against a
// real running SeeItLive API. This is not a mock/unit test — it makes real
// HTTP requests and asserts the shapes the SDK's TypeScript types promise
// actually match what the API returns.
//
// Usage:
//   npm run build   # produces ../dist (this script imports the built output)
//   SEEITLIVE_BASE_URL=http://localhost:3101/api/v1 \
//   SEEITLIVE_API_KEY=sil_test_xxx \
//   [SEEITLIVE_OAUTH_TOKEN=...] \
//   node scripts/validate.mjs
//
// Exits 0 if every check passes, non-zero (and prints a ✗ line) otherwise.

import { SeeItLive, NotFoundError, SeeItLiveError } from "../dist/index.js";

const baseUrl = process.env.SEEITLIVE_BASE_URL;
const apiKey = process.env.SEEITLIVE_API_KEY;
const oauthToken = process.env.SEEITLIVE_OAUTH_TOKEN;

if (!baseUrl) fail("SEEITLIVE_BASE_URL is required");
if (!apiKey) fail("SEEITLIVE_API_KEY is required");

function fail(message) {
  console.error(`\n✗ FATAL: ${message}`);
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`✓ ${label}`);
    passed++;
  } else {
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function describeError(err) {
  if (err instanceof SeeItLiveError) {
    return `${err.name} (statusCode=${err.statusCode}, code=${err.code ?? "none"}): ${err.message}`;
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

async function main() {
  console.log(`Validating @seeitlive/sdk (built dist) against ${baseUrl}\n`);

  // 1. Construction — env inferred from key prefix.
  let client;
  try {
    client = new SeeItLive({ apiKey, baseUrl });
    check("new SeeItLive({ apiKey, baseUrl }) constructs", true);
    check(
      'infers env "test" from sil_test_ prefix',
      client.env === "test",
      `got env=${JSON.stringify(client.env)}`,
    );
  } catch (err) {
    check("new SeeItLive({ apiKey, baseUrl }) constructs", false, describeError(err));
    console.log(summary());
    process.exit(1);
  }

  // 2. sessions.create({ channel: "link" }) — shape + field types.
  let session;
  try {
    session = await client.sessions.create({ channel: "link", note: "sdk validation" });
    check("sessions.create({ channel: 'link' }) resolves", true);
  } catch (err) {
    check("sessions.create({ channel: 'link' }) resolves", false, describeError(err));
  }

  if (session) {
    check("session.id is a non-empty string", typeof session.id === "string" && session.id.length > 0, JSON.stringify(session.id));
    check("session.status is a string", typeof session.status === "string", JSON.stringify(session.status));
    check(
      "session.inviteCode is a non-empty string",
      typeof session.inviteCode === "string" && session.inviteCode.length > 0,
      JSON.stringify(session.inviteCode),
    );
    check(
      "session.inviteUrl is a non-empty string",
      typeof session.inviteUrl === "string" && session.inviteUrl.length > 0,
      JSON.stringify(session.inviteUrl),
    );
    check(
      "session.agentViewUrl is a non-empty string",
      typeof session.agentViewUrl === "string" && session.agentViewUrl.length > 0,
      JSON.stringify(session.agentViewUrl),
    );
    check(
      "session.expiresAt is a string or null",
      session.expiresAt === null || typeof session.expiresAt === "string",
      `typeof=${typeof session.expiresAt} value=${JSON.stringify(session.expiresAt)}`,
    );
  } else {
    check("session.id is a non-empty string", false, "no session returned");
    check("session.status is a string", false, "no session returned");
    check("session.inviteCode is a non-empty string", false, "no session returned");
    check("session.inviteUrl is a non-empty string", false, "no session returned");
    check("session.agentViewUrl is a non-empty string", false, "no session returned");
    check("session.expiresAt is a string or null", false, "no session returned");
  }

  // 3. sessions.status(id) — shape.
  if (session) {
    try {
      const status = await client.sessions.status(session.id);
      check("sessions.status(id) resolves", true);
      check("status.id is a non-empty string", typeof status.id === "string" && status.id.length > 0, JSON.stringify(status.id));
      check("status.status is a string", typeof status.status === "string", JSON.stringify(status.status));
      check(
        "status.startedAt is a string or null",
        status.startedAt === null || typeof status.startedAt === "string",
        `typeof=${typeof status.startedAt}`,
      );
      check(
        "status.endedAt is a string or null",
        status.endedAt === null || typeof status.endedAt === "string",
        `typeof=${typeof status.endedAt}`,
      );
      check(
        "status.producerCount is a number",
        typeof status.producerCount === "number",
        `typeof=${typeof status.producerCount} value=${JSON.stringify(status.producerCount)}`,
      );
      check(
        "status.hasVideo is a boolean",
        typeof status.hasVideo === "boolean",
        `typeof=${typeof status.hasVideo} value=${JSON.stringify(status.hasVideo)}`,
      );
    } catch (err) {
      check("sessions.status(id) resolves", false, describeError(err));
      check("status.id is a non-empty string", false, "no status returned");
      check("status.status is a string", false, "no status returned");
      check("status.startedAt is a string or null", false, "no status returned");
      check("status.endedAt is a string or null", false, "no status returned");
      check("status.producerCount is a number", false, "no status returned");
      check("status.hasVideo is a boolean", false, "no status returned");
    }
  } else {
    check("sessions.status(id) resolves", false, "skipped — no session id from step 2");
  }

  // 4. Error mapping smoke: well-formed but nonexistent session id -> NotFoundError.
  try {
    await client.sessions.status("00000000-0000-0000-0000-000000000000");
    check("sessions.status(nonexistent id) throws NotFoundError", false, "did not throw");
  } catch (err) {
    check(
      "sessions.status(nonexistent id) throws NotFoundError",
      err instanceof NotFoundError,
      `got ${describeError(err)}`,
    );
    check(
      "NotFoundError.statusCode === 404",
      err instanceof NotFoundError && err.statusCode === 404,
      err instanceof NotFoundError ? `statusCode=${err.statusCode}` : "not a NotFoundError",
    );
  }

  // 5. OAuth verify — only if a token was provided.
  if (oauthToken) {
    try {
      const oauthClient = new SeeItLive({ oauthToken, baseUrl });
      const info = await oauthClient.oauth.verify();
      check("oauth.verify() resolves", true);
      check("info.valid is a boolean", typeof info.valid === "boolean", `typeof=${typeof info.valid}`);
      check("info.clientId is a string", typeof info.clientId === "string", `typeof=${typeof info.clientId}`);
      check("info.teamId is a string", typeof info.teamId === "string", `typeof=${typeof info.teamId}`);
      check("info.scopes is an array", Array.isArray(info.scopes), `typeof=${typeof info.scopes}`);
      check("info.plan is an object", typeof info.plan === "object" && info.plan !== null, `typeof=${typeof info.plan}`);
    } catch (err) {
      check("oauth.verify() resolves", false, describeError(err));
    }
  } else {
    console.log("(skipped: oauth.verify() — SEEITLIVE_OAUTH_TOKEN not set)");
  }

  console.log(summary());
  process.exit(failed > 0 ? 1 : 0);
}

function summary() {
  return `\n${passed} passed, ${failed} failed`;
}

main().catch((err) => {
  console.error(`\n✗ FATAL: unhandled error — ${describeError(err)}`);
  process.exit(1);
});
