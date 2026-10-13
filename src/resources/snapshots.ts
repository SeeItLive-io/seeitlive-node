import type { HttpClient } from "../http.js";
import type { SnapshotImage, SnapshotSummary } from "../types.js";

export class Snapshots {
  constructor(private readonly http: HttpClient) {}
  /** A session's snapshots, newest first. Requires the snapshot-history feature. */
  list(sessionId: string): Promise<SnapshotSummary[]> {
    return this.http.request<SnapshotSummary[]>(
      `/sessions/${encodeURIComponent(sessionId)}/snapshots`,
    );
  }
  /**
   * Fetch one snapshot as base64 JSON. The endpoint serves raw PNG bytes by
   * default; the SDK asks for `?format=base64` so the response stays JSON and
   * the signed path matches what the server verifies (path INCLUDING query).
   */
  get(id: string): Promise<SnapshotImage> {
    return this.http.request<SnapshotImage>(`/snapshots/${encodeURIComponent(id)}?format=base64`);
  }
}
