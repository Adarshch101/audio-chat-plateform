import { http } from "./http";
import type { SessionSummary, SessionDetail, ReviewStatus, TriageLevel } from "../types/session";

export interface SessionListResponse {
  sessions: SessionSummary[];
}

export interface SessionResponse {
  session: SessionDetail;
  triage: TriageLevel;
}

export interface UpdateSessionResponse {
  session: SessionDetail;
}

// Typed client for the `/api/sessions` REST endpoints. The view layer calls
// these functions instead of issuing raw fetch requests, keeping API wiring in
// one place.
export const sessionsApi = {
  list(): Promise<SessionListResponse> {
    return http.get<SessionListResponse>("/api/sessions");
  },

  get(sessionId: string): Promise<SessionResponse> {
    return http.get<SessionResponse>(`/api/sessions/${encodeURIComponent(sessionId)}`);
  },

  updateReviewStatus(sessionId: string, reviewStatus: ReviewStatus): Promise<UpdateSessionResponse> {
    return http.patch<UpdateSessionResponse>(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      { reviewStatus }
    );
  }
};