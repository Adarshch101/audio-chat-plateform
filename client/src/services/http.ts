import { apiBaseUrl } from "../utils/endpoints";

// Thin HTTP client for the backend REST API — the data-access ("model") layer
// for the React view. Components never call fetch directly; they use services.
function apiHeaders(): Record<string, string> {
  const token = import.meta.env.VITE_API_TOKEN as string | undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...apiHeaders(),
      ...(init?.headers ?? {})
    }
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export const http = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
};