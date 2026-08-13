import { useSyncExternalStore } from "react";
import { subscribeToasts, getToastSnapshot, toast } from "../services/toast";
import type { ToastKind } from "../services/toast";

const kindStyles: Record<ToastKind, { edge: string; accent: string }> = {
  info: { edge: "border-l-cyan-400", accent: "bg-cyan-400/15" },
  success: { edge: "border-l-emerald-400", accent: "bg-emerald-400/15" },
  error: { edge: "border-l-red-400", accent: "bg-red-400/15" },
  loading: { edge: "border-l-indigo-400", accent: "bg-indigo-400/15" }
};

function ToastIcon({ kind }: { kind: ToastKind }) {
  const accent = kindStyles[kind].accent;
  if (kind === "loading") {
    return (
      <svg className="animate-spin h-5 w-5 text-indigo-300" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );
  }
  return (
    <span className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${accent}`}>
      {kind === "success" ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : kind === "error" ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-red-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
      )}
    </span>
  );
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToastSnapshot);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2.5 pr-1 pointer-events-none"
    >
      {toasts.map((item) => {
        const style = kindStyles[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className={`glass rounded-xl border-l-4 ${style.edge} pl-4 pr-3 py-3 flex items-start gap-3 shadow-2xl shadow-slate-950/60 pointer-events-auto ${
              item.leaving ? "animate-toast-out" : "animate-toast-in"
            }`}
          >
            <ToastIcon kind={item.kind} />
            <p className="flex-1 text-sm text-slate-200 leading-relaxed break-words">{item.message}</p>
            <button
              onClick={() => toast.dismiss(item.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-slate-500 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/60 rounded"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Toaster;