import type { Env, SeeItLiveConfig } from "./types.js";
import { HttpClient } from "./http.js";
import { Sessions } from "./resources/sessions.js";
import { Snapshots } from "./resources/snapshots.js";
import { OAuth } from "./resources/oauth.js";

const DEFAULT_BASE_URL = "https://api.seeitlive.io/v1";

export class SeeItLive {
  readonly env: Env;
  readonly sessions: Sessions;
  readonly snapshots: Snapshots;
  readonly oauth: OAuth;

  constructor(config: SeeItLiveConfig) {
    // Treat an empty string as "not provided" (symmetric across both credentials),
    // so a blank env var never produces a bogus `Bearer ` header.
    const apiKey = config.apiKey || undefined;
    const oauthToken = config.oauthToken || undefined;
    if (!apiKey && !oauthToken) throw new Error("Either apiKey or oauthToken must be provided");
    if (apiKey && oauthToken) throw new Error("Provide only one of apiKey or oauthToken");
    const token = (apiKey ?? oauthToken) as string;
    this.env = config.env ?? (token.startsWith("sil_test_") ? "test" : "live");
    const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    // Same empty-string-means-absent convention as apiKey/oauthToken above.
    const signingSecret = config.signingSecret || undefined;
    const http = new HttpClient(baseUrl, `Bearer ${token}`, signingSecret);
    this.sessions = new Sessions(http);
    this.snapshots = new Snapshots(http);
    this.oauth = new OAuth(http);
  }
}
