import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Collection, MongoClient } from "mongodb";
import { MongoPersistenceService } from "../src/services/mongo.persistence.service";
import { sampleSession } from "./fixtures";

// Minimal in-memory stand-in for a MongoDB collection, mirroring only the
// driver surface MongoPersistenceService relies on.
class FakeCollection {
  docs = new Map<string, Record<string, unknown>>();

  async replaceOne(filter: { sessionId: string }, doc: Record<string, unknown>): Promise<{ upsertedCount: number }> {
    const had = this.docs.has(filter.sessionId);
    this.docs.set(filter.sessionId, { ...doc });
    return { upsertedCount: had ? 0 : 1 };
  }

  async findOne(filter: { sessionId: string }): Promise<Record<string, unknown> | null> {
    return this.docs.get(filter.sessionId) ?? null;
  }

  find(_filter: unknown, _options?: unknown): { toArray: () => Promise<Record<string, unknown>[]> } {
    return {
      toArray: async () => Array.from(this.docs.values())
    };
  }

  async deleteOne(filter: { sessionId: string }): Promise<{ deletedCount: number }> {
    return { deletedCount: this.docs.delete(filter.sessionId) ? 1 : 0 };
  }

  async findOneAndUpdate(
    filter: { sessionId: string },
    update: { $set: Record<string, unknown> },
    _options: { returnDocument: string }
  ): Promise<Record<string, unknown> | null> {
    const existing = this.docs.get(filter.sessionId);
    if (!existing) return null;
    const merged = { ...existing, ...update.$set };
    this.docs.set(filter.sessionId, merged);
    return merged;
  }
}

describe("MongoPersistenceService", () => {
  let fake: FakeCollection;
  let service: MongoPersistenceService;

  beforeAll(() => {
    fake = new FakeCollection();
    const fakeClient = { close: async () => {} } as unknown as MongoClient;
    service = new MongoPersistenceService(
      fakeClient,
      fake as unknown as Collection,
      "mongodb://fake",
      "test"
    );
  });

  afterAll(async () => {
    await service.close();
  });

  it("saves and reloads a full session without leaking _id", async () => {
    await service.saveSession(sampleSession("mongo-1", "hi"));
    const reloaded = await service.getSession("mongo-1");
    expect(reloaded).not.toBeNull();
    expect(reloaded?.sessionId).toBe("mongo-1");
    expect(reloaded?.collectedData.name).toBe("Adarsh");
    expect(reloaded?.conversation).toHaveLength(2);
    expect(reloaded?.report?.summary).toContain("headache");
    expect(reloaded).not.toHaveProperty("_id");
  });

  it("returns null for a missing session", async () => {
    expect(await service.getSession("missing")).toBeNull();
  });

  it("stores the sanitized document keyed by sessionId (upsert)", async () => {
    await service.saveSession(sampleSession("mongo-up", "hi"));
    const stored = fake.docs.get("mongo-up");
    expect(stored?.sessionId).toBe("mongo-up");
    expect(Object.prototype.hasOwnProperty.call(stored ?? {}, "updatedAt")).toBe(true);
  });

  it("round-trips a session with undefined optional fields", async () => {
    const partial = sampleSession("mongo-undef", "hi");
    delete partial.report;
    partial.collectedData.severity = undefined as unknown as string;
    await service.saveSession(partial);

    const reloaded = await service.getSession("mongo-undef");
    expect(reloaded?.collectedData.name).toBe("Adarsh");
    expect(reloaded?.report).toBeUndefined();
  });

  it("lists sessions (mapping only)", async () => {
    await service.saveSession(sampleSession("mongo-list", "hi"));
    const sessions = await service.listSessions();
    expect(sessions.some((s) => s.sessionId === "mongo-list")).toBe(true);
  });

  it("updates a session field and bumps updatedAt", async () => {
    await service.saveSession(sampleSession("mongo-review", "hi"));
    const original = await service.getSession("mongo-review");
    expect(original?.reviewStatus).toBeUndefined();

    const updated = await service.updateSession("mongo-review", { reviewStatus: "reviewed" });
    expect(updated?.reviewStatus).toBe("reviewed");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(original?.updatedAt ?? 0);

    expect((await service.getSession("mongo-review"))?.reviewStatus).toBe("reviewed");
  });

  it("returns null when updating a missing session", async () => {
    expect(await service.updateSession("missing", { reviewStatus: "reviewed" })).toBeNull();
  });

  it("deletes a session and reports failure on repeat", async () => {
    await service.saveSession(sampleSession("mongo-del", "hi"));
    expect(await service.deleteSession("mongo-del")).toBe(true);
    expect(await service.getSession("mongo-del")).toBeNull();
    expect(await service.deleteSession("mongo-del")).toBe(false);
  });
});

// True end-to-end coverage against a real MongoDB instance. Runs automatically
// when MONGODB_URI is set in the environment (e.g. `MONGODB_URI=mongodb://localhost:27017 npm test`).
describe.skipIf(!process.env.MONGODB_URI)("MongoPersistenceService integration", () => {
  let service: MongoPersistenceService;
  const dbName = process.env.MONGODB_TEST_DB || "health_voice_agent_test";

  beforeAll(async () => {
    service = await MongoPersistenceService.connect(process.env.MONGODB_URI!, dbName);
  });

  afterAll(async () => {
    await service.close();
  });

  it("persists, updates, lists, and deletes on a real MongoDB", async () => {
    await service.saveSession(sampleSession("it-integration"));
    const got = await service.getSession("it-integration");
    expect(got?.collectedData.name).toBe("Adarsh");

    const updated = await service.updateSession("it-integration", { reviewStatus: "reviewed" });
    expect(updated?.reviewStatus).toBe("reviewed");

    const sessions = await service.listSessions();
    expect(sessions.some((s) => s.sessionId === "it-integration")).toBe(true);

    expect(await service.deleteSession("it-integration")).toBe(true);
  });
});
