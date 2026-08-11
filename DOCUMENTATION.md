# AI Health Screening Voice Agent - System Documentation

This document serves as the project's master documentation, listing the complete layout, design choices, technologies, protocols, and verification tests.

---

## 1. Project Layout & Architecture

The workspace is organized as a monorepo using native **npm workspaces** to handle both client and server packages.

```text
health-voice-agent/ (Workspace Root)
│
├── client/                      # React Frontend Application (Vite + TS)
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── CallScreen.tsx   # Dashboard, session panels, dialogue logs, status display, timers, warnings
│   │   │   ├── MicrophoneButton.tsx # Push-to-Talk button with barge-in triggers
│   │   │   └── HealthReport.tsx # Dashboard displaying structured screening reports
│   │   ├── hooks/               # Custom hooks
│   │   │   ├── useWebSocket.ts  # Connection lifecycle, event listeners, and auto-cleanup hook
│   │   │   ├── useMicrophone.ts # Request mic stream, interval slicing, and Base64 encoder
│   │   │   ├── useAudioPlayer.ts # Sequential playback queue, Blob builders, responseId filters
│   │   │   └── useSilenceTimer.ts # Two-tier silence inactivity timer hook
│   │   ├── services/            # API/WebSocket client integrations (future)
│   │   ├── types/               # Type definitions
│   │   │   └── websocket.ts     # ClientMessage, ServerMessage, and CallStatus typings
│   │   ├── pages/               # Page layouts
│   │   ├── App.tsx              # Main entry point mounting CallScreen
│   │   ├── App.css              # Cleared stylesheet
│   │   ├── index.css            # Main CSS (imports Tailwind v4)
│   │   └── main.tsx             # React bootstrap mount
│   ├── vite.config.ts           # Vite config with Tailwind CSS v4 integration
│   ├── tsconfig.json            # Client TypeScript configuration (Strict mode)
│   └── package.json             # Client package dependencies
│
├── server/                      # Express Backend Server (Node.js + TS)
│   ├── src/
│   │   ├── websocket/           # WebSocket transport layer
│   │   │   └── callSocket.ts    # WS handler, session managers, safety writes, Abort controllers, responseId UUIDs
│   │   ├── services/            # Sub-pipeline services (STT, LLM, TTS, report, etc.)
│   │   │   ├── stt.service.ts   # Deepgram manager, turn synchronizer, chaos test hooks
│   │   │   ├── llm.service.ts   # OpenAI completions, Zod validations, chaos fail hooks
│   │   │   ├── conversation.service.ts # Session manager, state merging, Abort pass-downs
│   │   │   ├── tts.service.ts   # ElevenLabs fetch stream generator, language selection
│   │   │   └── report.service.ts # Report compiler, Zod validation, retry handles, abort signals
│   │   ├── prompts/             # System prompts for OpenAI models
│   │   │   ├── conversation.prompt.ts # System prompt containing agent intake rules
│   │   │   └── report.prompt.ts # System prompt containing clinical intake report rules
│   │   ├── schemas/             # JSON validation structures
│   │   │   └── report.schema.ts # Zod schema representing structured health report outputs
│   │   ├── types/               # TypeScript interfaces
│   │   │   ├── session.types.ts # Shared HealthSession & ConversationTurn types
│   │   │   └── websocket.ts     # Server ClientMessage & ServerMessage union types
│   │   ├── utils/               # Helper routines (future)
│   │   └── server.ts            # Core Express engine setup (includes WS attach)
│   ├── tsconfig.json            # Server TypeScript configuration (Strict mode)
│   └── package.json             # Server package dependencies (Express, ws, @deepgram/sdk, openai, zod, etc.)
│
├── .env.example                 # Declared configuration environment variables
├── .env                         # Local developer configuration variables
├── .gitignore                   # Directories ignored by VCS
├── README.md                    # Quick startup guide
├── DOCUMENTATION.md             # Detailed system documentation (This file)
└── package.json                 # Workspace config & unified script runner
```

---

## 2. Technology Stack & Versions

### Frontend (Client)
* **Vite v8.2.1**: Bundler and dev server.
* **React v19.2.8**: Component renderer.
* **TypeScript ~6.0.2**: Compiler configured in strict mode.
* **Tailwind CSS v4.3.3**: Styled utility classes.
* **@tailwindcss/vite v4.3.3**: Vite plugin for Tailwind v4.

### Backend (Server)
* **Express v4.19.2**: Web application framework.
* **ws v8.18.0**: Robust WebSocket server implementation.
* **@deepgram/sdk z3.9.0**: Official Speech-to-Text streaming SDK.
* **openai ^4.55.0**: Official OpenAI Node SDK for chat completions.
* **zod ^3.23.8**: Schema-based JSON validation tool.
* **CORS v2.8.5**: Cross-Origin Resource Sharing middleware.
* **dotenv v16.4.5**: Local configuration environments loader.
* **ts-node-dev v2.0.0**: Fast development loader with live-reloads.
* **TypeScript v5.4.5**: Strict compilation environment.

---

## 3. WebSocket Message Protocol

We enforce strong typings for all WebSocket exchanges between client and server:

### Client Messages (`ClientMessage`)
Sent from React frontend to Express backend:
* **`start_call`**: Initiates a session.
  ```json
  { "type": "start_call", "language": "en" | "hi" }
  ```
* **`audio_chunk`**: Incremental audio stream data block.
  ```json
  { "type": "audio_chunk", "data": "BASE64_STRING" }
  ```
* **`end_turn`**: Signals user finished speaking and triggers final STT compile.
  ```json
  { "type": "end_turn" }
  ```
* **`end_call`**: Requests session termination and report compiling.
  ```json
  { "type": "end_call" }
  ```
* **`retry_report`**: Triggers report regeneration using cached turns.
  ```json
  { "type": "retry_report" }
  ```
* **`silence_ping`**: Sent by client on 15s silence to trigger verbal warning prompts.
  ```json
  { "type": "silence_ping" }
  ```

### Server Messages (`ServerMessage`)
Sent from Express backend to React frontend:
* **`call_started`**: Returns generated session token.
  ```json
  { "type": "call_started", "sessionId": "UUID" }
  ```
* **`status`**: Updates client call status machine.
* **`assistant_message`**: Text transcript representing AI voice reply.
* **`transcript_partial` / `transcript_final`**: Live transcription events from Deepgram.
* **`stt_empty`**: Sent when Deepgram hears no speech or purely noise.
* **`audio_start`**: Signals the start of an AI voice synthesis stream, including its `responseId` (UUID).
  ```json
  { "type": "audio_start", "responseId": "UUID" }
  ```
* **`audio_chunk`**: Pushes base64 audio blocks matching the active `responseId`.
  ```json
  { "type": "audio_chunk", "responseId": "UUID", "data": "BASE64_MP3_DATA" }
  ```
* **`audio_end`**: Signals the end of the AI voice stream for the responseId.
  ```json
  { "type": "audio_end", "responseId": "UUID" }
  ```
* **`tts_error`**: Sent when voice synthesis fails.
* **`report_generating`**: Sent when the backend begins report synthesis.
* **`report_ready`**: Delivers the compiled, validated health intake report.
* **`report_failed`**: Sent if report generation fails, enabling retry triggers.
* **`call_ended`**: Signals cleanup is complete.
* **`error`**: Structured error message (guards stack trace leakage).

---

## 4. Call State Machine transitions
The client status transitions:
```text
           [idle] ➔ [connecting] ➔ [greeting]
                         │
                         ▼
                    [listening] ◄────────┐
                         │               │
                         ▼               │
                   [processing]          │
                         │               │
                         ▼               │
                    [speaking] ──────────┘
                         │
                         ▼
                 [generating_report]
                         │
                         ▼
                   [report_ready] ➔ [ended]
```
* Statuses `ended` and `error` represent terminal endpoints and reject other transitions except manual new screening resets back to `idle`.

---

## 5. Inactivity & Silence Thresholds
* **First silence timeout (15 seconds)**: If user fails to speak, client emits `{ type: "silence_ping" }`. Server responds with a verbal query *"Are you still there?"* / *"क्या आप वहां हैं?"* and streams its TTS.
* **Second silence timeout (15 seconds)**: Client emits another `{ type: "silence_ping" }`. Server responds with *"Would you like to continue or end the screening?"* / *"क्या आप परामर्श जारी रखना चाहते हैं या समाप्त करना चाहते हैं?"* allowing the user to resume instead of disconnecting immediately.

---

## 6. PTT Barge-In (Audio Interruptions)
* **PTT Interrupts**: The microphone button remains active during AI speech (`"speaking"` and `"greeting"` statuses). Holding down the button immediately calls `audioPlayer.stop()`, clears client URL buffers, invalidates the active `responseIdRef.current` value, and transitions back to `"listening"` to capture the user's speech.
* **UUID Frame Verification**: Chunks from past, interrupted streams carry outdated `responseId` values and are discarded by the client audio player queue, preventing race conditions.

---

## 7. Hindi Multilingual ACCENTS
* **ElevenLabs Speech Synthesis**: When language is set to Hindi (`"hi"`), the backend loads the **`eleven_multilingual_v2`** model. We lookup `ELEVENLABS_HINDI_VOICE_ID` in env variables to render Hindi speech with native accents.

---

## 8. Safe Transmissions & Resource Hardening
* **Safe WS Send Wrapper**: Emits messages only when `ws.readyState === WebSocket.OPEN`, avoiding uncaught closed connection exceptions.
* **Session AbortControllers**: Linked to each call session. When ending calls or closing sockets, abort controller instantly triggers `.abort()`, stopping OpenAI text completion, ElevenLabs fetches, and report requests, reclaiming server resources immediately.
* **Idempotency Locks**: Drops duplicate `end_turn` signals if session status is already processing a turn. Ignores duplicate `end_call` messages if a report compilation is currently active.
* **Chaos Testing Modes**: Developers can configure environment switches (`SIMULATE_STT_FAILURE`, `SIMULATE_LLM_FAILURE`, etc.) in `.env` to simulate service failures.
