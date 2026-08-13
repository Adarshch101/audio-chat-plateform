import { MongoClient, Collection, WithId, Document } from "mongodb";
import { HealthSession } from "../types/session.types";
import { SessionStore } from "./persistence.service";

const SESSIONS_COLLECTION = "sessions";

// BSON does not represent `undefined`. Strip undefined values (optional intake
// fields, optional report sections) so replaceOne/$set never reject a document.
function stripUndefined(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const cleaned = stripUndefined(item);
      if (cleaned !== undefined) out.push(cleaned);
    }
    return out;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripUndefined(item);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

function sanitizeSession<T>(value: T): T {
  return stripUndefined(value) as T;
}

// Strip the Mongo `_id` (and any ObjectId-typed driver coercion) so the REST API
// and dashboard always receive plain HealthSession documents.
function fromMongo(doc: WithId<Document>): HealthSession {
  const { _id, ...rest } = doc;
  return rest as unknown as HealthSession;
}

export class MongoPersistenceService implements SessionStore {
  constructor(
    private readonly client: MongoClient,
    private readonly collection: Collection,
    readonly uri: string,
    readonly dbName: string
  ) {}

  static async connect(
    uri: string,
    dbName: string,
    serverSelectionTimeoutMS = 5000
  ): Promise<MongoPersistenceService> {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS });
    await client.connect();
    const collection = client.db(dbName).collection<Document>(SESSIONS_COLLECTION);
    await collection.createIndex({ sessionId: 1 }, { unique: true });
    return new MongoPersistenceService(client, collection, uri, dbName);
  }

  async saveSession(session: HealthSession): Promise<void> {
    await this.collection.replaceOne(
      { sessionId: session.sessionId },
      sanitizeSession(session) as unknown as Document,
      { upsert: true }
    );
  }

  async getSession(sessionId: string): Promise<HealthSession | null> {
    const doc = await this.collection.findOne({ sessionId });
    return doc ? fromMongo(doc) : null;
  }

  async listSessions(): Promise<HealthSession[]> {
    const docs = await this.collection.find({}, { sort: { createdAt: -1 } }).toArray();
    return docs.map(fromMongo);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ sessionId });
    return result.deletedCount > 0;
  }

  async updateSession(sessionId: string, patch: Partial<HealthSession>): Promise<HealthSession | null> {
    const doc = await this.collection.findOneAndUpdate(
      { sessionId },
      { $set: { ...sanitizeSession(patch), updatedAt: Date.now() } },
      { returnDocument: "after" }
    );
    return doc ? fromMongo(doc) : null;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}