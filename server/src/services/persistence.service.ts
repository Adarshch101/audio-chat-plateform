import fs from "node:fs";
import path from "node:path";
import { HealthSession } from "../types/session.types";

// Storage backend contract used by the socket layer (writes) and the REST
// history API (reads). The backend is swappable: file-based (PersistenceService)
// or MongoDB (MongoPersistenceService) — see persistence.setup.ts.
export interface SessionStore {
  saveSession(session: HealthSession): Promise<void>;
  getSession(sessionId: string): Promise<HealthSession | null>;
  listSessions(): Promise<HealthSession[]>;
  deleteSession(sessionId: string): Promise<boolean>;
  updateSession(sessionId: string, patch: Partial<HealthSession>): Promise<HealthSession | null>;
  close(): Promise<void>;
}

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), "data");

export class PersistenceService implements SessionStore {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || process.env.DATA_DIR || DEFAULT_DATA_DIR;
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  get directory(): string {
    return this.dataDir;
  }

  private fileFor(sessionId: string): string {
    return path.join(this.dataDir, `${sessionId}.json`);
  }

  async saveSession(session: HealthSession): Promise<void> {
    const payload = JSON.stringify(session, null, 2);
    await fs.promises.writeFile(this.fileFor(session.sessionId), payload, "utf-8");
  }

  async getSession(sessionId: string): Promise<HealthSession | null> {
    try {
      const raw = await fs.promises.readFile(this.fileFor(sessionId), "utf-8");
      return JSON.parse(raw) as HealthSession;
    } catch {
      return null;
    }
  }

  async listSessions(): Promise<HealthSession[]> {
    let entries: string[];
    try {
      entries = await fs.promises.readdir(this.dataDir);
    } catch {
      return [];
    }

    const sessions: HealthSession[] = [];
    for (const file of entries) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await fs.promises.readFile(path.join(this.dataDir, file), "utf-8");
        sessions.push(JSON.parse(raw) as HealthSession);
      } catch {
        // Skip corrupt/partial files instead of failing the whole listing
      }
    }

    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await fs.promises.unlink(this.fileFor(sessionId));
      return true;
    } catch {
      return false;
    }
  }

  async updateSession(sessionId: string, patch: Partial<HealthSession>): Promise<HealthSession | null> {
    const existing = await this.getSession(sessionId);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await this.saveSession(updated);
    return updated;
  }

  async close(): Promise<void> {
    // File-backed store holds no resources to release.
  }
}