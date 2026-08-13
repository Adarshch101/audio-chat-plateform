import { PersistenceService, SessionStore } from "./persistence.service";
import { MongoPersistenceService } from "./mongo.persistence.service";

// Process-wide storage backend. Defaults to the file store; switched to MongoDB
// at startup when MONGODB_URI is set (or PERSISTENCE=mongodb is requested).
let store: SessionStore = new PersistenceService();

/**
 * Resolve and connect the persistence backend based on configuration.
 *
 *   PERSISTENCE=auto    (default) — use MongoDB when MONGODB_URI is set, else file store
 *   PERSISTENCE=mongodb            — force MongoDB (defaults to localhost:27017)
 *   PERSISTENCE=file               — force JSON file storage under DATA_DIR
 *
 * If an explicit MongoDB connection fails, the server logs the error and falls
 * back to the file store so the API keeps working.
 */
export async function initPersistence(): Promise<SessionStore> {
  const backend = (process.env.PERSISTENCE || "auto").toLowerCase();
  const uri = process.env.MONGODB_URI;
  const useMongo = backend === "mongodb" || backend === "mongo" || (backend === "auto" && !!uri);

  if (!useMongo) {
    console.log("[PERSISTENCE] File store active (DATA_DIR). Set MONGODB_URI (or PERSISTENCE=mongodb) to use MongoDB.");
    return store;
  }

  const mongoUri = uri || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB || "health_voice_agent";
  try {
    store = await MongoPersistenceService.connect(mongoUri, dbName);
    console.log(`[PERSISTENCE] MongoDB connected (db="${dbName}").`);
  } catch (err) {
    console.error("[PERSISTENCE] MongoDB connection failed — falling back to file store:", (err as Error).message);
    store = new PersistenceService();
  }
  return store;
}

export async function closePersistence(): Promise<void> {
  await store.close();
}

// Swappable singleton; resolves to whichever backend is active at call time.
// Imported by the socket layer (writes) and the REST history API (reads).
export const persistenceService: SessionStore = {
  saveSession: (session) => store.saveSession(session),
  getSession: (sessionId) => store.getSession(sessionId),
  listSessions: () => store.listSessions(),
  deleteSession: (sessionId) => store.deleteSession(sessionId),
  updateSession: (sessionId, patch) => store.updateSession(sessionId, patch),
  close: () => store.close()
};