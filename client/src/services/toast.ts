// Dependency-free toast store. UI fires notifications with the `toast` API and
// the <Toaster /> component (in components/Toaster.tsx) renders whatever the
// store currently holds, subscribed through useSyncExternalStore. This keeps
// the notifications logic separate from the view that paints them.

export type ToastKind = "info" | "success" | "error" | "loading";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  leaving: boolean;
}

let snapshot: ToastItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function setSnapshot(next: ToastItem[]): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToastSnapshot(): ToastItem[] {
  return snapshot;
}

function push(kind: ToastKind, message: string, duration: number): number {
  const id = ++counter;
  setSnapshot([...snapshot, { id, kind, message, leaving: false }]);
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: number): void {
  const item = snapshot.find((t) => t.id === id);
  if (!item || item.leaving) return;
  // Play the exit animation before removing the toast from the list.
  setSnapshot(snapshot.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  window.setTimeout(() => {
    setSnapshot(snapshot.filter((t) => t.id !== id));
  }, 200);
}

export const toast = {
  info: (message: string): number => push("info", message, 4500),
  success: (message: string): number => push("success", message, 4500),
  error: (message: string): number => push("error", message, 6500),
  loading: (message: string): number => push("loading", message, 0),
  dismiss
};