import dotenv from "dotenv";
import path from "path";

// Load environment variables immediately before importing the app or services.
// (The TypeScript output is CommonJS, so this runs before any module below.)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "./.env") });

import type { Server } from "http";
import { createApp } from "./app";
import { initWebSocketServer } from "./websocket/callSocket";
import { initPersistence, closePersistence } from "./services/persistence.setup";

if (!process.env.DEEPGRAM_API_KEY) {
  console.warn("[STT WARNING] DEEPGRAM_API_KEY is not configured.");
}

if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
  console.warn("[LLM WARNING] Neither GROQ_API_KEY nor OPENAI_API_KEY is configured. LLM features will be unavailable.");
} else if (process.env.GROQ_API_KEY) {
  console.log("[LLM] Groq API key detected. Using Groq as primary LLM provider.");
} else {
  console.log("[LLM] OpenAI API key detected. Using OpenAI as LLM provider.");
}

if (!process.env.ELEVENLABS_API_KEY) {
  console.warn("[TTS WARNING] ELEVENLABS_API_KEY is not configured.");
}

if (!process.env.ELEVENLABS_VOICE_ID && !process.env.ELEVENLABS_ENGLISH_VOICE_ID) {
  console.warn("[TTS WARNING] Neither ELEVENLABS_VOICE_ID nor ELEVENLABS_ENGLISH_VOICE_ID is configured.");
}

if (!process.env.ELEVENLABS_HINDI_VOICE_ID) {
  console.warn("[TTS WARNING] ELEVENLABS_HINDI_VOICE_ID is not configured. Hindi voice synthesis will fallback to default voice.");
}

const app = createApp();
const PORT = process.env.PORT || 5000;

let server: Server | undefined;

async function start(): Promise<void> {
  await initPersistence();

  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Initialize WebSocket Server
  initWebSocketServer(server);
}

void start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// Handle graceful shutdown
function shutdown(signal: string): void {
  console.log(`${signal} signal received: closing HTTP server`);
  server?.close(() => {
    console.log("HTTP server closed");
  });
  void closePersistence().finally(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));