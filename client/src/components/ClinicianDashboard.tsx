import { useCallback, useEffect, useState } from "react";
import type { SessionSummary, SessionDetail, TriageLevel } from "../types/session";
import { sessionsApi } from "../services/sessions.service";
import { toast } from "../services/toast";
import { LoadingScreen } from "./LoadingScreen";
import HealthReport from "./HealthReport";

const triageStyles: Record<TriageLevel, { badge: string; label: string }> = {
  urgent: { badge: "bg-red-500 text-white", label: "Urgent" },
  high: { badge: "bg-amber-500 text-slate-950", label: "High" },
  routine: { badge: "bg-emerald-400/10 text-emerald-300 border border-emerald-400/30", label: "Routine" }
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function ClinicianDashboard() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sessionsApi.list();
      setSessions(data.sessions ?? []);
    } catch (err) {
      console.error("[Dashboard] Failed to load sessions:", err);
      setError("Could not load sessions. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openSession = async (sessionId: string) => {
    setSelected(null);
    setError(null);
    try {
      const data = await sessionsApi.get(sessionId);
      setSelected(data.session);
    } catch (err) {
      console.error("[Dashboard] Failed to load session:", err);
      setError("Could not load the selected session.");
    }
  };

  const toggleReviewed = async (sessionId: string, reviewStatus: "pending" | "reviewed") => {
    try {
      const data = await sessionsApi.updateReviewStatus(sessionId, reviewStatus);
      setSelected(data.session);
      // Reflect the change in the list too.
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, reviewStatus } : s))
      );
      toast.success(
        reviewStatus === "reviewed" ? "Session marked as reviewed." : "Session marked as pending."
      );
    } catch (err) {
      console.error("[Dashboard] Failed to update review status:", err);
      toast.error("Could not update the review status.");
    }
  };

  const pendingCount = sessions.filter((s) => s.triage === "urgent" && s.reviewStatus !== "reviewed").length;

  return (
    <div className="w-full max-w-3xl glass rounded-3xl p-6 sm:p-8 flex flex-col gap-6 animate-fadeIn shadow-2xl">
      {/* Header */}
      <div className="flex justify-between items-center gap-3 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Clinician Dashboard</h1>
          <p className="text-xs text-slate-500">Persisted screening intakes with triage</p>
        </div>
        <button
          onClick={loadList}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 font-bold rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-200 text-sm rounded-xl p-4 font-medium">
          {error}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-xs text-red-200 font-semibold">
          {pendingCount} unreviewed intake{sessions.length === 1 ? "" : "s"} flagged urgent.
        </div>
      )}

      {selected ? (
        /* Detail view */
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setSelected(null)}
            className="self-start px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 font-bold rounded-xl text-xs transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            ← Back to list
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-mono">{selected.sessionId}</span>
            <span className="text-slate-700">•</span>
            <span>{formatDate(selected.createdAt)}</span>
            <span className="text-slate-700">•</span>
            <span>{selected.language === "hi" ? "Hindi" : "English"}</span>
            <button
              onClick={() =>
                toggleReviewed(
                  selected.sessionId,
                  selected.reviewStatus === "reviewed" ? "pending" : "reviewed"
                )
              }
              className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 ${
                selected.reviewStatus === "reviewed"
                  ? "bg-amber-500/15 text-amber-300 border border-amber-400/30 hover:bg-amber-500/25"
                  : "bg-emerald-500 text-white hover:bg-emerald-400"
              }`}
            >
              {selected.reviewStatus === "reviewed" ? "Mark Unreviewed" : "Mark Reviewed"}
            </button>
          </div>

          {selected.report ? (
            <>
              <HealthReport
                report={selected.report}
                transcript={selected.conversation.map((t) => ({
                  sender: t.role,
                  text: t.text,
                  timestamp: t.timestamp
                }))}
                onNewScreening={() => setSelected(null)}
                actionLabel="Back to List"
              />
              {/* Raw collected data for the clinician */}
              <details className="border border-white/10 rounded-xl bg-white/5">
                <summary className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer">
                  Raw collected data
                </summary>
                <pre className="p-4 text-xs text-slate-300 overflow-x-auto bg-slate-950/50 border-t border-white/10">
                  {JSON.stringify(selected.collectedData, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-sm text-amber-200 font-medium">
              No structured report was generated for this session (report may have failed).
            </div>
          )}
        </div>
      ) : (
        /* List view */
        <div className="flex flex-col gap-2">
          {loading ? (
            <LoadingScreen message="Loading sessions…" />
          ) : sessions.length === 0 ? (
            <div className="text-sm text-slate-500 italic py-8 text-center">
              No completed screenings yet. Complete a call to see it here.
            </div>
          ) : (
            sessions.map((s) => {
              const t = triageStyles[s.triage];
              return (
                <button
                  key={s.sessionId}
                  onClick={() => openSession(s.sessionId)}
                  className="w-full text-left bg-white/5 hover:bg-white/10 active:bg-white/[0.13] border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-3 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                >
                  <span className="flex flex-col gap-0.5 min-w-[160px]">
                    <span className="text-sm font-bold text-white">
                      {s.patientName || "Unknown patient"}
                    </span>
                    <span className="text-xs text-slate-400 truncate">{s.mainConcern || "No concern recorded"}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono hidden sm:block">
                    {formatDate(s.createdAt)}
                  </span>
                  {s.severity && (
                    <span className="text-xs font-semibold text-slate-300 border border-white/10 bg-white/5 rounded-full px-2 py-0.5">
                      {s.severity}
                    </span>
                  )}
                  <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${t.badge}`}>
                    {t.label}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${
                      s.reviewStatus === "reviewed"
                        ? "bg-white/10 text-slate-400"
                        : "bg-cyan-400/10 text-cyan-300 border border-cyan-400/20"
                    }`}
                  >
                    {s.reviewStatus === "reviewed" ? "Reviewed" : "Pending"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default ClinicianDashboard;