import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PersistenceService } from "../src/services/persistence.service";
import { sampleSession } from "./fixtures";

let dir: string;
let service: PersistenceService;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "health-sessions-"));
  service = new PersistenceService(dir);
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("PersistenceService", () => {
  it("saves and reloads a session with its report", async () => {
    await service.saveSession(sampleSession("s-1"));
    const reloaded = await service.getSession("s-1");
    expect(reloaded).not.toBeNull();
    expect(reloaded?.collectedData.additionalContext).toBe("taken paracetamol");
    expect(reloaded?.report?.missingInformation).toContain("Allergies");
  });

  it("returns null for a missing session", async () => {
    expect(await service.getSession("does-not-exist")).toBeNull();
  });

  it("lists sessions newest-first", async () => {
    const a = sampleSession("s-newer");
    a.createdAt = 3000;
    const b = sampleSession("s-older");
    b.createdAt = 1000;
    await service.saveSession(b);
    await service.saveSession(a);

    const sessions = await service.listSessions();
    const ids = sessions.map((s) => s.sessionId);
    expect(ids.indexOf("s-newer")).toBeLessThan(ids.indexOf("s-older"));
  });

  it("deletes a session", async () => {
    expect(await service.deleteSession("s-1")).toBe(true);
    expect(await service.getSession("s-1")).toBeNull();
    expect(await service.deleteSession("s-1")).toBe(false);
  });

  it("returns null when updating a missing session", async () => {
    expect(await service.updateSession("does-not-exist", { reviewStatus: "reviewed" })).toBeNull();
  });

  it("updates a session field (reviewStatus) and bumps updatedAt", async () => {
    await service.saveSession(sampleSession("s-update"));
    const original = await service.getSession("s-update");
    expect(original?.reviewStatus).toBeUndefined();

    const updated = await service.updateSession("s-update", { reviewStatus: "reviewed" });
    expect(updated?.reviewStatus).toBe("reviewed");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(original?.updatedAt ?? 0);

    const reloaded = await service.getSession("s-update");
    expect(reloaded?.reviewStatus).toBe("reviewed");
  });
});