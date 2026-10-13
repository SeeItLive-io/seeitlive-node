import { describe, expect, it } from "vitest";
import { signRequest } from "./signing.js";

const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("signRequest", () => {
  it("matches the known-answer vector for a POST with a body", () => {
    const headers = signRequest(SECRET, "POST", "/sessions", '{"channel":"demo"}', 1800000000);
    expect(headers).toEqual({
      "X-SeeItLive-Signature": "sha256=a59401f3e80ae2e50f4b2517c8e4708de856bb93eadb1f4cfc59100db2b6e7f7",
      "X-SeeItLive-Timestamp": "1800000000",
    });
  });

  it("matches the known-answer vector for a GET with no body", () => {
    const headers = signRequest(SECRET, "GET", "/sessions/x/status", undefined, 1800000000);
    expect(headers["X-SeeItLive-Signature"]).toBe(
      "sha256=3499dfb7f9581f996d537dfb108f775cb329f1f3f490f3bcb791820b4d81d5ea",
    );
    expect(headers["X-SeeItLive-Timestamp"]).toBe("1800000000");
  });

  it("upper-cases the method so lower-case input yields the same signature", () => {
    const upper = signRequest(SECRET, "POST", "/sessions", '{"channel":"demo"}', 1800000000);
    const lower = signRequest(SECRET, "post", "/sessions", '{"channel":"demo"}', 1800000000);
    expect(lower).toEqual(upper);
  });
});
