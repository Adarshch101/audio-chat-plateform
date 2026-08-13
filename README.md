# AI Health Screening Voice Agent

A production-grade, turn-based voice conversation interface for an AI health-screening assistant, compiling clinical intake reports upon completion.

---

## 1. System Overview & Features

This application establishes a real-time voice screening session between a React client and an Express backend over a JSON WebSocket protocol. Key features include:

- **Live Voice Health Screening**: Users speak their concerns and hear spoken AI responses.
- **Typed Responses**: Users can type answers instead of speaking; typed turns are processed identically to voice turns.
- **Real-Time Microphone Streaming**: Captures audio chunks in standard WebM/Opus and streams them via WebSocket.
- **Deepgram Streaming STT**: Employs Deepgram's live streaming connection (`nova-3` model) with turn synchronization and noise checks.
- **Live Auto Language Detection**: Nova-3 "multi" transcribes English and Hindi in a single stream, and the assistant switches language in real time based on what the patient speaks or types (Devanagari script detection).
- **OpenAI Conversational Reasoning**: Dynamically updates user variables, maintaining conversation history (context-bounded).
- **ElevenLabs Streaming TTS**: Streams real-time speech synthesis chunk-by-chunk for low-latency feedback; the spoken voice follows the detected language.
- **Hindi & English Multilingual Support**: Language-aware prompts and accents. Uses ElevenLabs `eleven_multilingual_v2` for natural Hindi accents.
- **PTT Barge-In Interruptions**: Users can hold down the PTT button to speak and interrupt AI speech immediately.
- **Double-Click & Idempotency Safeguards**: Prevents duplicate requests if a turn is processing or a report is compiling.
- **Silence Inactivity Timers**: Dual-tier inactivity alerts ask the user if they want to continue before wrapping up.
- **Safety & Care Announcements**: Displays urgent safety notice flags if dangerous medical issues are mentioned.
- **Structured Clinician Intake Reports**: Compiles fact-based intake summaries validated by Zod at the end of each session. Supports failed report retries.
- **Richer Intake Model**: Beyond the core concern, the assistant collects medications, allergies, medical/family history, smoking status, onset, triggers, and reported vitals.
- **Session Persistence & History API**: Completed sessions and their reports are persisted to **MongoDB** (with an automatic JSON-file fallback) and retrievable over REST.
- **Clinician Dashboard**: A practitioner view lists persisted intakes with rules-based urgency triage (urgent / high / routine), full report + raw-data drill-down, and review tracking.
- **Optional Auth & Rate Limiting**: Bearer-token auth for REST + WebSocket and per-IP rate limiting can be enabled via env vars.
- **Turn Timeouts & Resilient Parsing**: Per-turn LLM timeouts prevent hung sessions, and model output is parsed tolerance of markdown fences/prose.

---

## 2. System Architecture

The codebase follows a Model–View–Controller split on both ends:

- **Backend** (`server/src`): `controllers/` (HTTP handlers) + `routes/` (path→controller mapping) form the Controller; `services/` + `persistence.*` + `types/`/`schemas/` form the Model; controllers serialize the JSON responses (View). `app.ts` assembles the Express app; `server.ts` is only the HTTP bootstrap; `websocket/` is the realtime channel controller.
- **Frontend** (`client/src`): `pages/` + `components/` are the View; `hooks/` (e.g. `useCallSession`, `useWebSocket`) are the Controller — all interaction/state orchestration, never duplicated in JSX; `services/` (HTTP/REST client) + `types/` are the Model.

```text
React Frontend                                     Express Backend
 │                                                  │
 ├─ components/ + pages/  (View)                    ├─ routes/ ── controllers/   (Controller)
 ├─ hooks/useCallSession  (Controller)              ├─ websocket/callSocket.ts   (WS Controller)
 └─ services/ + types/    (Model)                   ├─ services/ + persistence/  (Model)
     │                                               └─ models: types + schemas
     │
     │ WebSocket (Base64 JSON Protocol) + REST
     ▼
Node.js Express Server
 │
 ├── Deepgram STT (Speech-to-Text streaming)
 │
 ├── Conversation Service
 │       │
 │       └── OpenAI Chat Completions (Extraction & Adaptive questions)
 │
 ├── ElevenLabs TTS (Audio synthesis streaming)
 │
 └── Report Service
         │
         └── OpenAI JSON Mode (Structured clinical intakes validated by Zod)

MongoDB (completed sessions + reports)   ←─   Persistence Service (file fallback)
```

### Conversational Voice Flow
`User Speech ➔ Deepgram STT ➔ Conversation State ➔ OpenAI LLM ➔ ElevenLabs TTS ➔ Browser Speaker`

---

## 3. WebSocket Message Protocol

### Client to Server Messages (`ClientMessage`)
- **`start_call`**: `{ "type": "start_call", "language": "en" | "hi" }`
- **`audio_chunk`**: `{ "type": "audio_chunk", "data": "BASE64_WEBM_DATA" }`
- **`text_message`**: `{ "type": "text_message", "text": "user typed response" }`
- **`end_turn`**: `{ "type": "end_turn" }`
- **`end_call`**: `{ "type": "end_call" }`
- **`retry_report`**: `{ "type": "retry_report" }`
- **`silence_ping`**: `{ "type": "silence_ping" }`

### Server to Client Messages (`ServerMessage`)
- **`call_started`**: `{ "type": "call_started", "sessionId": "UUID" }`
- **`status`**: `{ "type": "status", "status": CallStatus }`
- **`assistant_message`**: `{ "type": "assistant_message", "text": "spoken response text" }`
- **`transcript_partial` / `transcript_final`**: Live transcription events from Deepgram.
- **`language_detected`**: `{ "type": "language_detected", "language": "en" | "hi", "source": "speech" | "text" }` — the assistant switched languages after detecting what the patient said/typed.
- **`stt_empty`**: Sent on noise-only or silent turns.
- **`audio_start` / `audio_chunk` / `audio_end`**: Frames carrying base64 synthesized MP3 audio with associated `responseId`.
- **`report_generating`**: Signals that OpenAI is compiling the report.
- **`report_ready`**: Delivers the completed intake summary validated by Zod.
- **`report_failed`**: Sent on report compile failures.
- **`call_ended`**: Signals cleanup is complete.
- **`error`**: Technical error boundary payloads.

---

## 4. REST History API

Completed sessions (including their structured reports) are persisted to **MongoDB** (collection `sessions` in `MONGODB_DB`) and exposed over HTTP. When `MONGODB_URI` is unset (or `PERSISTENCE=file`), the server falls back to JSON files under `DATA_DIR` (default `./data`):

- `GET /health` — service health check (no auth required).
- `GET /api/sessions` — lightweight list of persisted sessions (id, language, patient name, main concern, severity, follow-up flag count, **triage**: urgent/high/routine, review status).
- `GET /api/sessions/:sessionId` — full session including collected data, transcript, the validated report, and its triage level.
- `PATCH /api/sessions/:sessionId` — update fields (e.g. `{ "reviewStatus": "reviewed" }`).
- `DELETE /api/sessions/:sessionId` — remove a persisted session.

> **Auth (optional):** Set `API_AUTH_TOKEN` in `.env` to protect both the API and the WebSocket. REST requires `Authorization: Bearer <token>`; the browser client must set `VITE_API_TOKEN` (client `.env`) so the WS upgrade sends `?token=<token>`. `ALLOWED_ORIGINS` (comma-separated) restricts CORS; `RATE_LIMIT_MAX` caps API requests per IP per 60s.

## 5. Client Views

A dark, modern product website with React Router-based navigation (header + footer on every page):

- **`/` Home** — branded landing page: hero, feature grid, how-it-works, and calls to action.
- **`/screening`** — the live voice/typed call screen.
- **`/dashboard`** — the clinician dashboard listing persisted intakes with urgency badges, full reports + raw collected data, and review tracking. No special auth beyond the API token above.

---

## 6. API Provider Decisions

- **Speech-to-Text: Deepgram (Nova-2)**
  - Selected for its ultra-low latency websocket streams and exceptional transcription accuracy.
- **LLM: Groq (llama-3.3-70b-versatile) with OpenAI (GPT-4o-Mini) fallback**
  - Groq is selected as the primary provider for its free tier, speed, and OpenAI-compatible API. OpenAI is used automatically when no `GROQ_API_KEY` is configured.
- **Text-to-Speech: ElevenLabs**
  - Selected for its highly natural voices and low-latency HTTP synthesis stream capabilities.

---

## 7. Development Setup & Launch

### Prerequisites
Make sure to create a `.env` file at the root workspace directory matching `.env.example`:
```env
PORT=5000
DEEPGRAM_API_KEY=your_deepgram_key
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
# --- Persistence (optional; file storage is used when MONGODB_URI is unset) ---
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=health_voice_agent
```

> Note: `GROQ_API_KEY` is optional. When set it is used as the primary LLM provider; otherwise the app falls back to `OPENAI_API_KEY`.

### Run MongoDB
Start a local MongoDB (or bring one up via the included manifest):
```bash
docker compose up -d
# or run a native instance:
# mongod --dbpath /path/to/data/db
```
The server connects when `MONGODB_URI` is set. If MongoDB is unreachable it logs a warning and falls back to the JSON-file store (`DATA_DIR`). Set `PERSISTENCE=mongodb` to force MongoDB, or `PERSISTENCE=file` to always use files.

### Installation
Installs dependencies for both client and server:
```bash
npm install
```

### Run Dev Servers
Starts both frontend and backend concurrently:
```bash
npm run dev
```

### Compile & Build Checks
Transpiles TypeScript projects for production:
```bash
npm run build
```

### Run Tests
Runs the server unit/integration suite (vitest):
```bash
npm test
```
> The MongoDB integration tests run automatically when a live instance is available: `MONGODB_URI=mongodb://localhost:27017 npm test`.

---

## 8. Known Limitations

- **PTT Interface**: Voice interaction relies on Push-to-Talk touch pointer gestures rather than VAD (Voice Activity Detection), ensuring latency controls.
- **Browser Autoplay Checks**: The browser requires page interaction (e.g. clicking the Start Call button) before playing ElevenLabs audio streams.
- **In-Memory Active Sessions**: Live sessions are held in memory; only *completed* sessions with reports are persisted (to MongoDB, or the file fallback). A server restart during an active call clears it.
- **Hindi TTS Accents**: Quality of Hindi pronunciation depends on the ElevenLabs voice and the multilingual synthesis model configured in your keys.
