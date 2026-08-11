# AI Health Screening Voice Agent

A production-grade, turn-based voice conversation interface for an AI health-screening assistant, compiling clinical intake reports upon completion.

---

## 1. System Overview & Features

This application establishes a real-time voice screening session between a React client and an Express backend over a JSON WebSocket protocol. Key features include:

- **Live Voice Health Screening**: Users speak their concerns and hear spoken AI responses.
- **Real-Time Microphone Streaming**: Captures audio chunks in standard WebM/Opus and streams them via WebSocket.
- **Deepgram Streaming STT**: Employs Deepgram's live streaming connection (`nova-2` model) with turn synchronization and noise checks.
- **OpenAI Conversational Reasoning**: Dynamically updates user variables, maintaining conversation history (context-bounded).
- **ElevenLabs Streaming TTS**: Streams real-time speech synthesis chunk-by-chunk for low-latency feedback.
- **Hindi & English Multilingual Support**: Language-aware prompts and accents. Uses ElevenLabs `eleven_multilingual_v2` for natural Hindi accents.
- **PTT Barge-In Interruptions**: Users can hold down the PTT button to speak and interrupt AI speech immediately.
- **Double-Click & Idempotency Safeguards**: Prevents duplicate requests if a turn is processing or a report is compiling.
- **Silence Inactivity Timers**: Dual-tier inactivity alerts ask the user if they want to continue before wrapping up.
- **Safety & Care Announcements**: Displays urgent safety notice flags if dangerous medical issues are mentioned.
- **Structured Clinician Intake Reports**: Compiles fact-based intake summaries validated by Zod at the end of each session. Supports failed report retries.

---

## 2. System Architecture

```text
React Frontend
 │
 │ WebSocket (Base64 JSON Protocol)
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
```

### Conversational Voice Flow
`User Speech ➔ Deepgram STT ➔ Conversation State ➔ OpenAI LLM ➔ ElevenLabs TTS ➔ Browser Speaker`

---

## 3. WebSocket Message Protocol

### Client to Server Messages (`ClientMessage`)
- **`start_call`**: `{ "type": "start_call", "language": "en" | "hi" }`
- **`audio_chunk`**: `{ "type": "audio_chunk", "data": "BASE64_WEBM_DATA" }`
- **`end_turn`**: `{ "type": "end_turn" }`
- **`end_call`**: `{ "type": "end_call" }`
- **`retry_report`**: `{ "type": "retry_report" }`
- **`silence_ping`**: `{ "type": "silence_ping" }`

### Server to Client Messages (`ServerMessage`)
- **`call_started`**: `{ "type": "call_started", "sessionId": "UUID" }`
- **`status`**: `{ "type": "status", "status": CallStatus }`
- **`assistant_message`**: `{ "type": "assistant_message", "text": "spoken response text" }`
- **`transcript_partial` / `transcript_final`**: Live transcription events from Deepgram.
- **`stt_empty`**: Sent on noise-only or silent turns.
- **`audio_start` / `audio_chunk` / `audio_end`**: Frames carrying base64 synthesized MP3 audio with associated `responseId`.
- **`report_generating`**: Signals that OpenAI is compiling the report.
- **`report_ready`**: Delivers the completed intake summary validated by Zod.
- **`report_failed`**: Sent on report compile failures.
- **`call_ended`**: Signals cleanup is complete.
- **`error`**: Technical error boundary payloads.

---

## 4. API Provider Decisions

- **Speech-to-Text: Deepgram (Nova-2)**
  - Selected for its ultra-low latency websocket streams and exceptional transcription accuracy.
- **LLM: OpenAI (GPT-4o-Mini)**
  - Selected for its low cost, JSON-mode compatibility, and robust context reasoning.
- **Text-to-Speech: ElevenLabs**
  - Selected for its highly natural voices and low-latency HTTP synthesis stream capabilities.

---

## 5. Development Setup & Launch

### Prerequisites
Make sure to create a `.env` file at the root workspace directory matching `.env.example`:
```env
PORT=5000
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

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

---

## 6. Known Limitations

- **PTT Interface**: Voice interaction relies on Push-to-Talk touch pointer gestures rather than VAD (Voice Activity Detection), ensuring latency controls.
- **Browser Autoplay Checks**: The browser requires page interaction (e.g. clicking the Start Call button) before playing ElevenLabs audio streams.
- **In-Memory Storage**: Dialogue sessions and compiled reports are stored in-memory. Reloading the server clears active registries.
- **Hindi TTS Accents**: Quality of Hindi pronunciation depends on the ElevenLabs voice and the multilingual synthesis model configured in your keys.
