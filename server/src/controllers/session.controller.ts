import { Request, Response } from "express";
import { persistenceService } from "../services/persistence.setup";
import { computeTriage } from "../utils/triage";
import type { HealthSession } from "../types/session.types";

// Controllers own the request→response lifecycle (the "controller" layer of the
// MVC structure). They interpret HTTP requests, delegate to the persistence
// model, and serialize the JSON "view" returned to the client. No business
// logic or storage access lives in the route definitions themselves.

export async function listSessions(_req: Request, res: Response): Promise<void> {
  try {
    const sessions = await persistenceService.listSessions();
    // Lightweight summaries; full transcripts/reports are served on demand.
    res.json({
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        language: s.language,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        patientName: s.collectedData?.name ?? null,
        mainConcern: s.collectedData?.mainConcern ?? null,
        severity: s.collectedData?.severity ?? null,
        followUpFlagsCount: s.report?.followUpFlags?.length ?? 0,
        triage: computeTriage(s),
        reviewStatus: s.reviewStatus ?? "pending",
        hasReport: !!s.report
      }))
    });
  } catch (err) {
    console.error("[API] Failed to list sessions:", err);
    res.status(500).json({ error: "Failed to list sessions." });
  }
}

export async function getSession(req: Request, res: Response): Promise<void> {
  try {
    const session = await persistenceService.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ session, triage: computeTriage(session) });
  } catch (err) {
    console.error("[API] Failed to load session:", err);
    res.status(500).json({ error: "Failed to load session." });
  }
}

export async function patchSession(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<HealthSession> = {};

    if ("reviewStatus" in body) {
      if (body.reviewStatus !== "pending" && body.reviewStatus !== "reviewed") {
        res.status(400).json({ error: "reviewStatus must be 'pending' or 'reviewed'." });
        return;
      }
      patch.reviewStatus = body.reviewStatus;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No supported fields provided." });
      return;
    }

    const updated = await persistenceService.updateSession(req.params.sessionId, patch);
    if (!updated) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ session: updated });
  } catch (err) {
    console.error("[API] Failed to update session:", err);
    res.status(500).json({ error: "Failed to update session." });
  }
}

export async function deleteSession(req: Request, res: Response): Promise<void> {
  try {
    const deleted = await persistenceService.deleteSession(req.params.sessionId);
    if (!deleted) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error("[API] Failed to delete session:", err);
    res.status(500).json({ error: "Failed to delete session." });
  }
}