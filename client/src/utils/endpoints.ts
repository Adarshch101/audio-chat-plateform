// Centralized endpoint configuration. The browser talks to the API server on a
// fixed dev port; override with VITE_API_PORT when the backend runs elsewhere.
const API_PORT = (import.meta.env.VITE_API_PORT as string | undefined) ?? "5000";

export function apiBaseUrl(): string {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${window.location.hostname}:${API_PORT}`;
}

export function webSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:${API_PORT}`;
}