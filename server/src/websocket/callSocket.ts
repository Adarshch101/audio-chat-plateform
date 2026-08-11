import { WebSocket, WebSocketServer } from "ws";
import { Server } from "http";
import crypto from "crypto";
import { ClientMessage, ServerMessage } from "../types/websocket";
import { SpeechToTextService } from "../services/stt.service";
import { ConversationService } from "../services/conversation.service";
import { TextToSpeechService } from "../services/tts.service";
import { ReportService } from "../services/report.service";

interface SessionState {
  sessionId: string;
  language: "en" | "hi";
  status: "idle" | "active" | "generating_report" | "ended";
  sttService: SpeechToTextService;
  abortController: AbortController;
  isProcessingTurn: boolean;
  silenceCount: number;
  sttErrorSent: boolean;
}

const activeSessions = new Map<WebSocket, SessionState>();
const conversationService = new ConversationService();
const ttsService = new TextToSpeechService();
const reportService = new ReportService();

export function initWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] New client connected");

    ws.on("message", async (data: Buffer | string) => {
      try {
        let rawMessage = "";
        if (typeof data === "string") {
          rawMessage = data;
        } else if (Buffer.isBuffer(data)) {
          rawMessage = data.toString("utf-8");
        } else {
          rawMessage = Buffer.from(data as any).toString("utf-8");
        }

        if (rawMessage.length > 500000) {
          sendError(ws, "Message size exceeds safety threshold (500 KB).");
          return;
        }

        let parsedPayload: unknown;
        try {
          parsedPayload = JSON.parse(rawMessage);
        } catch (err) {
          sendError(ws, "Invalid JSON payload.");
          return;
        }

        if (
          !parsedPayload ||
          typeof parsedPayload !== "object" ||
          !("type" in parsedPayload)
        ) {
          sendError(ws, "Malformed payload: Missing 'type' field.");
          return;
        }

        const clientMessage = parsedPayload as Partial<ClientMessage>;
        const session = activeSessions.get(ws);

        switch (clientMessage.type) {
          case "start_call": {
            if (session) {
              sendError(ws, "Call has already been started for this connection.");
              return;
            }

            const startMsg = clientMessage as Extract<ClientMessage, { type: "start_call" }>;
            if (!startMsg.language || (startMsg.language !== "en" && startMsg.language !== "hi")) {
              sendError(ws, "Invalid or unsupported language parameter. Supported values: 'en', 'hi'.");
              return;
            }

            const sttService = new SpeechToTextService();
            if (!sttService.isAvailable()) {
              console.error("[WS] start_call rejected: DEEPGRAM_API_KEY is not configured.");
              sendError(ws, "Speech recognition is temporarily unavailable (Missing API Key).");
              return;
            }

            const sessionId = crypto.randomUUID();
            const abortController = new AbortController();

            try {
              sttService.createStream(
                startMsg.language,
                (text) => sendJson(ws, { type: "transcript_partial", text }),
                (text) => sendJson(ws, { type: "transcript_final", text }),
                (err) => {
                  console.error("[STT] Deepgram client reported error:", err);
                  // Only send the first STT error to client to avoid flooding
                  const currentSession = activeSessions.get(ws);
                  if (currentSession && !currentSession.sttErrorSent) {
                    currentSession.sttErrorSent = true;
                    sendJson(ws, {
                      type: "error",
                      message: "Speech recognition is temporarily unavailable."
                    });
                  }
                }
              );
            } catch (err) {
              console.error("[WS] Failed to initialize Deepgram stream:", err);
              sendError(ws, "Failed to initialize Speech recognition stream.");
              return;
            }

            // Register in-memory conversation session
            conversationService.createSession(sessionId, startMsg.language);

            const sessionObj: SessionState = {
              sessionId,
              language: startMsg.language,
              status: "active",
              sttService,
              abortController,
              isProcessingTurn: false,
              silenceCount: 0,
              sttErrorSent: false
            };

            activeSessions.set(ws, sessionObj);

            console.log(`[CALL] Session started: ${sessionId} (Language: ${startMsg.language})`);

            sendJson(ws, {
              type: "call_started",
              sessionId
            });

            sendJson(ws, {
              type: "status",
              status: "greeting" // Transition into greeting status explicitly
            });

            const initialGreeting = startMsg.language === "hi"
              ? "नमस्ते! मैं आपका स्वास्थ्य मूल्यांकन सहायक हूँ। परामर्श से पहले मैं आपसे कुछ बुनियादी सवाल पूछूँगा। कृपया अपना नाम बताएं?"
              : "Hello! I'm your AI health screening assistant. I'll ask you a few questions about how you're feeling. Could you please tell me your name?";

            // Record greet turn in conversation history
            conversationService.updateCollectedData(sessionId, {});
            conversationService.getSession(sessionId)?.conversation.push({
              role: "assistant",
              text: initialGreeting,
              timestamp: Date.now()
            });

            sendJson(ws, {
              type: "assistant_message",
              text: initialGreeting
            });

            // Stream greeting TTS in background with a fresh responseId
            const responseId = crypto.randomUUID();
            setTimeout(() => {
              streamTtsToClient(ws, sessionObj, initialGreeting, responseId);
            }, 50);

            break;
          }

          case "audio_chunk": {
            if (!session || session.status !== "active") {
              return;
            }

            const audioMsg = clientMessage as Extract<ClientMessage, { type: "audio_chunk" }>;
            if (!audioMsg.data || typeof audioMsg.data !== "string") {
              sendError(ws, "Malformed payload: Missing or invalid 'data' field for audio chunk.");
              return;
            }

            try {
              const buffer = Buffer.from(audioMsg.data, "base64");
              session.sttService.sendAudioChunk(buffer);
            } catch (err) {
              console.error("[WS] Error forwarding audio chunk to STT:", err);
            }
            break;
          }

          case "end_turn": {
            if (!session || session.status !== "active") {
              sendError(ws, "No active session found. Please start a call first.");
              return;
            }

            // Idempotency lock
            if (session.isProcessingTurn) {
              console.log("[WS] Duplicate end_turn request ignored.");
              return;
            }

            session.isProcessingTurn = true;
            session.silenceCount = 0; // Reset silence tracker on user turn
            console.log(`[WS] Turn processing started for session: ${session.sessionId}.`);

            sendJson(ws, {
              type: "status",
              status: "processing"
            });

            try {
              // Await outstanding voice buffer transcription from Deepgram
              const finalTranscript = await session.sttService.waitForFinalResult(2000);
              console.log(`[STT] session=${session.sessionId} final transcript compiled: "${finalTranscript}"`);

              if (!finalTranscript || finalTranscript.trim() === "" || isNoiseOnly(finalTranscript)) {
                console.log(`[WS] Empty or noise-only turn. Triggering stt_empty for session: ${session.sessionId}`);
                sendJson(ws, { type: "stt_empty" });
                sendJson(ws, { type: "status", status: "listening" });
                session.isProcessingTurn = false;
              } else {
                // Confirm the consolidated text segment reaches the client UI
                sendJson(ws, {
                  type: "transcript_final",
                  text: finalTranscript
                });

                // Process turn through Conversation Service (invokes OpenAI)
                const decision = await conversationService.processUserTurn(
                  session.sessionId,
                  finalTranscript,
                  session.abortController.signal
                );

                // Check abort state
                if (session.abortController.signal.aborted) {
                  return;
                }

                // Push text response to chat log
                sendJson(ws, {
                  type: "assistant_message",
                  text: decision.spokenResponse
                });

                // Update state to speaking before starting stream
                sendJson(ws, {
                  type: "status",
                  status: "speaking"
                });

                // Stream voice audio to client with responseId
                const responseId = crypto.randomUUID();
                await streamTtsToClient(ws, session, decision.spokenResponse, responseId);

                // If completed or urgent, wrap up session and generate health report
                if (decision.nextAction === "complete" || decision.nextAction === "urgent_attention") {
                  // End STT connection early
                  try {
                    session.sttService.finishStream();
                  } catch (e) {}

                  // Trigger Report Generation
                  await triggerReportGeneration(ws, session);
                } else {
                  session.isProcessingTurn = false;
                }
              }

              // Clear local recorder buffers
              session.sttService.clearBuffer();

            } catch (err: any) {
              session.isProcessingTurn = false;
              if (err.name === "AbortError") {
                console.log("[WS] Processing turn aborted.");
                return;
              }
              console.error("[ERROR] STT turn processing error:", err);
              sendError(ws, "Something went wrong while processing your response.");
              sendJson(ws, {
                type: "status",
                status: "listening"
              });
            }
            break;
          }

          case "end_call": {
            if (!session) {
              sendError(ws, "No active session found.");
              return;
            }

            // Duplicate protection
            if (session.status === "generating_report" || session.status === "ended") {
              console.log("[WS] Duplicate end_call request ignored.");
              return;
            }

            console.log(`[CALL] Ending call and compiling report for session: ${session.sessionId}`);
            
            // Abort pending operations
            session.abortController.abort();

            // Stop audio recorder stream
            try {
              session.sttService.finishStream();
            } catch (e) {}

            // Generate Report
            await triggerReportGeneration(ws, session);
            break;
          }

          case "retry_report": {
            if (!session) {
              sendError(ws, "No active session found to retry report generation.");
              return;
            }

            // Duplicate protection
            if (session.status === "generating_report" || session.status === "ended") {
              console.log("[WS] Duplicate retry_report request ignored.");
              return;
            }

            console.log(`[REPORT] Retrying report generation for session: ${session.sessionId}`);
            await triggerReportGeneration(ws, session);
            break;
          }

          case "silence_ping": {
            if (!session || session.status !== "active" || session.isProcessingTurn) {
              return;
            }

            session.silenceCount += 1;
            console.log(`[CALL] Silence alert count=${session.silenceCount} for session: ${session.sessionId}.`);

            let silencePrompt = "";
            if (session.silenceCount === 1) {
              silencePrompt = session.language === "hi"
                ? "क्या आप वहां हैं?"
                : "Are you still there?";
            } else {
              silencePrompt = session.language === "hi"
                ? "क्या आप परामर्श जारी रखना चाहते हैं या समाप्त करना चाहते हैं?"
                : "Would you like to continue or end the screening?";
            }
            
            // Add prompt warning to conversation logs
            conversationService.getSession(session.sessionId)?.conversation.push({
              role: "assistant",
              text: silencePrompt,
              timestamp: Date.now()
            });

            sendJson(ws, {
              type: "assistant_message",
              text: silencePrompt
            });

            sendJson(ws, {
              type: "status",
              status: "speaking"
            });

            const responseId = crypto.randomUUID();
            await streamTtsToClient(ws, session, silencePrompt, responseId);
            break;
          }

          default: {
            sendError(ws, "Unsupported WebSocket message type.");
            break;
          }
        }
      } catch (err) {
        console.error("[ERROR] Uncaught WS client action exception:", err);
        sendError(ws, "Something went wrong while processing your request.");
      }
    });

    ws.on("close", () => {
      const session = activeSessions.get(ws);
      if (session) {
        console.log(`[WS] Client disconnected. Cleaning up session: ${session.sessionId}`);
        session.status = "ended";
        session.abortController.abort(); // Cancel pending API calls instantly
        try {
          session.sttService.finishStream();
        } catch (e) {}
        conversationService.deleteSession(session.sessionId);
        activeSessions.delete(ws);
      } else {
        console.log("[WS] Client disconnected (no active session)");
      }
    });

    ws.on("error", (err) => {
      console.error("[ERROR] WebSocket connection error:", err);
      const session = activeSessions.get(ws);
      if (session) {
        session.status = "ended";
        session.abortController.abort();
        try {
          session.sttService.finishStream();
        } catch (e) {}
        conversationService.deleteSession(session.sessionId);
        activeSessions.delete(ws);
      }
    });
  });

  console.log("WebSocket server integrated and listening");
}

/**
 * Triggers clinical intake report compilation via the OpenAI ReportService
 */
async function triggerReportGeneration(ws: WebSocket, session: SessionState) {
  session.status = "generating_report";
  sendJson(ws, { type: "report_generating" });

  const fullSession = conversationService.getSession(session.sessionId);
  if (!fullSession) {
    console.error(`[REPORT] Compilation failed: Session ${session.sessionId} not found.`);
    sendJson(ws, {
      type: "report_failed",
      message: "Session not found."
    });
    return;
  }

  // Create a new AbortController for report to support cancel on closed socket
  const reportAbortController = new AbortController();

  try {
    const report = await reportService.generateReport(fullSession, reportAbortController.signal);
    fullSession.report = report;

    // Send final report
    sendJson(ws, {
      type: "report_ready",
      report
    });

    // Mark session as fully complete
    sendJson(ws, { type: "call_ended" });
    session.status = "ended";
    
    // Clean up registry references
    conversationService.deleteSession(session.sessionId);
    activeSessions.delete(ws);

  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[REPORT] Report compilation aborted.");
      return;
    }
    console.error("[REPORT] Generation failed completely:", err);
    session.status = "active"; // Restore back to active so user can trigger retry
    session.isProcessingTurn = false;
    sendJson(ws, {
      type: "report_failed",
      message: "We couldn't generate the full report. Please try again."
    });
  }
}

/**
 * Pipes voice synthesis audio chunks from ElevenLabs to the client connection
 */
async function streamTtsToClient(
  ws: WebSocket,
  session: SessionState,
  text: string,
  responseId: string
) {
  if (!ttsService.isAvailable()) {
    console.warn("[TTS] ElevenLabs service is not configured. Continuing in text-only mode.");
    sendJson(ws, {
      type: "tts_error",
      message: "Voice playback is unavailable (Missing API Key). Continuing with text only."
    });
    // Transition back to listening so call continues without audio
    if (session.status === "active" && ws.readyState === WebSocket.OPEN) {
      sendJson(ws, { type: "status", status: "listening" });
    }
    return;
  }

  try {
    sendJson(ws, { type: "audio_start", responseId });

    const audioStream = await ttsService.generateSpeechStream(
      text,
      session.language,
      session.abortController.signal
    );

    for await (const chunk of audioStream) {
      // Race guard: If call has been terminated/aborted, end stream immediately
      if (session.status !== "active" || session.abortController.signal.aborted || ws.readyState !== WebSocket.OPEN) {
        console.log(`[TTS] Session ${session.sessionId} is no longer active. Interrupting stream loop.`);
        break;
      }

      const base64Data = chunk.toString("base64");
      sendJson(ws, {
        type: "audio_chunk",
        responseId,
        data: base64Data
      });
    }

    if (session.status === "active" && !session.abortController.signal.aborted && ws.readyState === WebSocket.OPEN) {
      sendJson(ws, { type: "audio_end", responseId });
      console.log(`[TTS] Streaming completed for session: ${session.sessionId}, responseId=${responseId}`);
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[TTS] Audio streaming aborted.");
      return;
    }
    console.error("[TTS] ElevenLabs audio generation error:", err);
    sendJson(ws, {
      type: "tts_error",
      message: "Voice playback failed. Continuing with text only."
    });
    // Transition back to listening so call continues without crashing
    if (session.status === "active" && ws.readyState === WebSocket.OPEN) {
      sendJson(ws, { type: "audio_end", responseId });
      sendJson(ws, { type: "status", status: "listening" });
    }
  }
}

function isNoiseOnly(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const noise = new Set(["uh", "um", "ah", "er", "oh"]);
  return noise.has(clean);
}

function sendJson(ws: WebSocket, message: ServerMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error("[ERROR] Safe WS write failed:", err);
    }
  }
}

function sendError(ws: WebSocket, reason: string) {
  sendJson(ws, {
    type: "error",
    message: reason
  });
}
