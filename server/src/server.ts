import dotenv from "dotenv";
import path from "path";

// Load environment variables immediately before importing services or socket controllers
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "./.env") });

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { initWebSocketServer } from "./websocket/callSocket";

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

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// 404 Route handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize WebSocket Server
initWebSocketServer(server);

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});
