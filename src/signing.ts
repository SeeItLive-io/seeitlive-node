import { createHash, createHmac } from "node:crypto";

/**
 * Computes the HMAC request-signature headers per the SeeItLive wire contract:
 *
 *   signature = HMAC_SHA256(secret, `${timestamp}.${METHOD}.${path}.${sha256hex(rawBody)}`)
 *
 * - `timestamp` is unix seconds.
 * - `method` is upper-cased.
 * - `path` is exactly the request path (no base URL, no `/api/v1` prefix).
 * - `body` must be the exact serialized bytes sent as the request body (e.g. the
 *   `JSON.stringify(...)` result); pass `undefined` when the request has no body,
 *   which hashes as the empty string.
 */
export function signRequest(
  secret: string,
  method: string,
  path: string,
  body: string | undefined,
  timestamp: number,
): { "X-SeeItLive-Signature": string; "X-SeeItLive-Timestamp": string } {
  const bodyHash = createHash("sha256").update(body ?? "").digest("hex");
  const message = `${timestamp}.${method.toUpperCase()}.${path}.${bodyHash}`;
  const signature = createHmac("sha256", secret).update(message).digest("hex");
  return {
    "X-SeeItLive-Signature": `sha256=${signature}`,
    "X-SeeItLive-Timestamp": String(timestamp),
  };
}
