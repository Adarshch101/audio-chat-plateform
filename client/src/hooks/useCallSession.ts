import { useCallback, useEffect, useRef, useState } from "react";
import useWebSocket from "./useWebSocket";
import useMicrophone from "./useMicrophone";
import useAudioPlayer from "./useAudioPlayer";
import useSilenceTimer from "./useSilenceTimer";
import useBrowserTTS from "./useBrowserTTS";
import { detectLanguageFromText } from "../utils/language";
import { webSocketUrl } from "../utils/endpoints";
import { toast } from "../services/toast";
import type {
  CallStatus,
  AppError,
  ClientMessage
} from "../types/websocket";
import type { HealthReport, ChatTurn } from "../types/session";

export type ReportStatus = "idle" | "generating" | "ready" | "failed";
export type ProcessingPhase = "transcribing" | "thinking";

export interface UseCallSession {
  // Connection
  isConnected: boolean;
  status: CallStatus;
  language: "en" | "hi";
  setLanguage: (language: "en" | "hi") => void;
  sessionId: string | null;
  processingPhase: ProcessingPhase;
  isSpeaking: boolean;

  // Transcript / input
  chatLog: ChatTurn[];
  interimText: string;
  draftText: string;
  setDraftText: (text: string) => void;

  // Microphone
  isRecording: boolean;

  // Report
  reportStatus: ReportStatus;
  generatedReport: HealthReport | null;

  // App error
  appError: AppError | null;
  dismissError: () => void;

  // Call duration
  callDuration: number;

  // Actions (controller entry points for the view)
  startCall: () => void;
  endCall: () => void;
  startRecordingTurn: () => void;
  stopRecordingTurn: () => void;
  sendText: () => void;
  newScreening: () => void;
  retryReport: () => void;
}

export function useCallSession(): UseCallSession {
  const {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    lastMessage,
    takeNextMessage,
    error: wsError,
    setError: setWsError
  } = useWebSocket();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatLog, setChatLog] = useState<ChatTurn[]>([]);
  const [interimText, setInterimText] = useState<string>("");
  const [draftText, setDraftText] = useState<string>("");

  // Health report states
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");
  const [generatedReport, setGeneratedReport] = useState<HealthReport | null>(null);

  // App error states
  const [appError, setAppError] = useState<AppError | null>(null);

  // Call duration counter
  const [callDuration, setCallDuration] = useState<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for postponed reports
  const storedReportRef = useRef<HealthReport | null>(null);
  const [isCallEnding, setIsCallEnding] = useState(false);
  const isCallEndingRef = useRef(false);

  // Browser TTS fallback (when ElevenLabs is unavailable)
  const browserTTS = useBrowserTTS();
  const ttsUnavailableRef = useRef(false);
  const lastAssistantTextRef = useRef<string>("");
  // Guard against committing more than one user transcript per turn
  const turnCommittedRef = useRef(false);
  // Phase indicator while a turn is being processed server-side
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>("transcribing");
  // Text of the last optimistically-committed typed message, so its server
  // echo (transcript_final) can be deduped instead of adding a duplicate bubble.
  const optimisticTurnRef = useRef<string | null>(null);

  useEffect(() => {
    isCallEndingRef.current = isCallEnding;
  }, [isCallEnding]);

  // Enforce strict call state machine transitions
  const transitionStatus = (nextStatus: CallStatus) => {
    const invalidTransitions: Record<CallStatus, CallStatus[]> = {
      idle: [],
      connecting: ["idle"],
      greeting: ["idle"],
      listening: ["idle"],
      processing: ["idle"],
      speaking: ["idle"],
      ending: [],
      generating_report: ["idle"],
      report_ready: [],
      error: [],
      ended: []
    };

    const blockList = invalidTransitions[status] || [];
    if (blockList.includes(nextStatus)) {
      console.warn(`[STATE] Blocked invalid status transition: ${status} -> ${nextStatus}`);
      return;
    }
    console.log(`[STATE] Transition: ${status} -> ${nextStatus}`);
    setStatus(nextStatus);
  };

  // Safe Web Socket message sender wrapper
  const safeSendMessage = (message: ClientMessage) => {
    if (isConnected) {
      sendMessage(message);
    } else {
      console.warn("[WS] Attempted to transmit message on closed WebSocket connection:", message);
    }
  };

  // Audio Playback queue callback
  const audioPlayer = useAudioPlayer({
    onQueueDrained: () => {
      if (isCallEndingRef.current) {
        console.log("[CallScreen] Voice buffer drained. Transitioning to ended.");
        setIsCallEnding(false);
        stopRecording();
        disconnect();
        transitionStatus("ended");

        if (storedReportRef.current) {
          setGeneratedReport(storedReportRef.current);
          setReportStatus("ready");
          storedReportRef.current = null;
        }
      } else {
        console.log("[CallScreen] Voice buffer drained. Unlocking microphone.");
        transitionStatus("listening");
      }
    }
  });

  // Microphone stream recorder
  const {
    isRecording,
    startRecording,
    stopRecording,
    error: micError,
    setError: setMicError
  } = useMicrophone({
    onAudioChunk: (base64) => {
      safeSendMessage({
        type: "audio_chunk",
        data: base64
      });
    }
  });

  // Wire Silence timer hook (Two-Tier timeout trigger)
  const { reset: resetSilenceTimer } = useSilenceTimer({
    onFirstTimeout: () => {
      console.log("[CallScreen] Silence timer first warn.");
      safeSendMessage({ type: "silence_ping" });
    },
    onSecondTimeout: () => {
      console.log("[CallScreen] Silence timer second warn.");
      safeSendMessage({ type: "silence_ping" });
    },
    status,
    isRecording,
    disabled: draftText.trim().length > 0
  });

  // Handle call duration counter
  useEffect(() => {
    const isCallActive =
      status !== "idle" &&
      status !== "ended" &&
      status !== "error" &&
      status !== "report_ready" &&
      status !== "generating_report";

    if (isCallActive) {
      if (!durationIntervalRef.current) {
        setCallDuration(0);
        durationIntervalRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [status]);

  // Handle socket connection boot
  useEffect(() => {
    if (isConnected && status === "connecting") {
      safeSendMessage({
        type: "start_call",
        language
      });
    }
  }, [isConnected, status, language]);

  // Unexpected WS disconnection cleanup
  useEffect(() => {
    if (!isConnected && status !== "idle" && status !== "ended" && status !== "error" && status !== "connecting" && reportStatus === "idle") {
      console.log("[WS] Unexpected disconnect detected. Cleaning up.");
      audioPlayer.stop();
      stopRecording();
      transitionStatus("error");
      setWsError("Unexpectedly disconnected from server.");
      setAppError({
        code: "WEBSOCKET_ERROR",
        message: "WebSocket connection dropped unexpectedly.",
        recoverable: true
      });
    }
  }, [isConnected, status, reportStatus]);

  // Catch mic errors and propagate to error model
  useEffect(() => {
    if (micError) {
      setAppError({
        code: "MICROPHONE_DENIED",
        message: micError,
        recoverable: true
      });
    }
  }, [micError]);

  // Process server events and update UI state machine.
  // Drains the queued messages in order so rapid bursts (status, transcript,
  // assistant_message, audio frames) are all processed — not just the last one.
  useEffect(() => {
    while (true) {
      const msg = takeNextMessage();
      if (msg === null) break;
      switch (msg.type) {
        case "call_started":
          setSessionId(msg.sessionId);
          break;
        case "status":
          // Map server status directly to state machine wrapper
          transitionStatus(msg.status);
          break;
        case "assistant_message":
          lastAssistantTextRef.current = msg.text;
          setChatLog((prev) => [
            ...prev,
            { sender: "assistant", text: msg.text, timestamp: Date.now() }
          ]);
          break;
        case "transcript_partial":
          setInterimText(msg.text);
          break;
        case "transcript_final":
          setInterimText("");
          // While the user is still holding the PTT button, live Deepgram final
          // segments are shown as interim text and committed only once the turn
          // completes (via the server's consolidated transcript_final).
          if (isRecording) {
            setInterimText(msg.text);
            break;
          }
          // The consolidated transcript arriving means STT is done and the LLM
          // is now reasoning about the turn.
          if (status === "processing") {
            setProcessingPhase("thinking");
          }
          // Typed messages were already shown optimistically on send; drop the
          // server echo so it doesn't render a duplicate bubble.
          if (optimisticTurnRef.current === msg.text) {
            optimisticTurnRef.current = null;
            turnCommittedRef.current = true;
            break;
          }
          if (turnCommittedRef.current) break;
          turnCommittedRef.current = true;
          setChatLog((prev) => [
            ...prev,
            { sender: "user", text: msg.text, timestamp: Date.now() }
          ]);
          break;
        case "stt_empty":
          setChatLog((prev) => [
            ...prev,
            { sender: "assistant", text: language === "hi" ? "मुझे ठीक से समझ नहीं आया। कृपया दोबारा कहें।" : "I didn't quite catch that. Please try again.", timestamp: Date.now() }
          ]);
          setInterimText("");
          break;

        // Auto-detected language (from spoken transcript or typed message)
        case "language_detected":
          if (msg.language !== language) {
            console.log(`[LANG] Server detected ${msg.language} (${msg.source}), switching UI language.`);
            setLanguage(msg.language);
          }
          break;

        // Audio stream events
        case "audio_start":
          audioPlayer.setActiveResponseId(msg.responseId);
          transitionStatus("speaking");
          break;
        case "audio_chunk":
          audioPlayer.addChunk(msg.data, msg.responseId);
          break;
        case "audio_end":
          audioPlayer.setAudioEnd(msg.responseId);
          break;
        case "tts_error":
          // ElevenLabs failed — switch to browser TTS fallback
          console.log("[TTS Fallback] ElevenLabs unavailable. Using browser speech synthesis.");
          ttsUnavailableRef.current = true;
          // Speak the last assistant message using browser TTS
          if (lastAssistantTextRef.current) {
            transitionStatus("speaking");
            browserTTS.speak(lastAssistantTextRef.current, language, () => {
              // When browser TTS finishes, transition to listening
              transitionStatus("listening");
            });
          } else {
            // No text to speak — go straight to listening
            transitionStatus("listening");
          }
          break;

        // Report stream events
        case "report_generating":
          setReportStatus("generating");
          transitionStatus("generating_report");
          break;
        case "report_ready":
          toast.success("Your screening report is ready.");
          if (audioPlayer.isPlaying) {
            storedReportRef.current = msg.report;
            setIsCallEnding(true);
          } else {
            setGeneratedReport(msg.report);
            setReportStatus("ready");
            stopRecording();
            disconnect();
            transitionStatus("ended");
          }
          break;
        case "report_failed":
          setReportStatus("failed");
          setAppError({
            code: "REPORT_ERROR",
            message: "Structured screening report compilation failed.",
            recoverable: true
          });
          break;

        case "call_ended":
          if (audioPlayer.isPlaying) {
            setIsCallEnding(true);
          } else {
            stopRecording();
            disconnect();
            transitionStatus("ended");
          }
          break;
        case "error":
          if (status !== "error" && status !== "ended" && status !== "idle") {
            audioPlayer.stop();
            stopRecording();
            transitionStatus("error");
            disconnect();
            setAppError({
              code: "SESSION_ERROR",
              message: msg.message,
              recoverable: true
            });
          }
          break;
        default:
          break;
      }
    }
  }, [lastMessage, takeNextMessage, disconnect, stopRecording, audioPlayer, language, isRecording, status]);

  // Handle manual state changes on WebSocket issues
  useEffect(() => {
    if (wsError && !appError && status !== "error" && status !== "ended" && status !== "idle") {
      audioPlayer.stop();
      stopRecording();
      transitionStatus("error");
      disconnect();
      setAppError({
        code: "WEBSOCKET_ERROR",
        message: wsError,
        recoverable: true
      });
    }
  }, [wsError, disconnect, stopRecording, audioPlayer, appError, status]);

  const startCall = () => {
    audioPlayer.stop();
    browserTTS.stop();
    ttsUnavailableRef.current = false;
    lastAssistantTextRef.current = "";
    turnCommittedRef.current = false;
    optimisticTurnRef.current = null;
    setProcessingPhase("transcribing");
    setIsCallEnding(false);
    storedReportRef.current = null;
    setReportStatus("idle");
    setGeneratedReport(null);
    setChatLog([]);
    setInterimText("");
    setDraftText("");
    setSessionId(null);
    setWsError(null);
    setMicError(null);
    setAppError(null);
    resetSilenceTimer();
    setCallDuration(0);
    transitionStatus("connecting");
    connect(webSocketUrl());
  };

  const endCall = () => {
    audioPlayer.stop();
    browserTTS.stop();
    stopRecording();
    setIsCallEnding(false);
    setInterimText("");
    resetSilenceTimer();
    if (isConnected) {
      safeSendMessage({ type: "end_call" });
    } else {
      disconnect();
      transitionStatus("idle");
    }
  };

  // Barge-In interrupt controller inside Push-to-Talk triggers
  const startRecordingTurn = () => {
    const isAiSpeaking = status === "speaking" || status === "greeting";

    if ((status === "listening" || isAiSpeaking) && !isRecording) {
      if (isAiSpeaking) {
        console.log("[BARGE-IN] User speaking. Interrupting AI playback streams.");
        audioPlayer.stop();
        browserTTS.stop();
        audioPlayer.setActiveResponseId(null); // Invalidate current responseId immediately
        transitionStatus("listening");
      }
      setInterimText("");
      turnCommittedRef.current = false;
      startRecording();
    }
  };

  const stopRecordingTurn = () => {
    stopRecording();
    // End the turn: STT is consolidating the final transcript.
    setProcessingPhase("transcribing");
    safeSendMessage({ type: "end_turn" });
  };

  const sendText = () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;

    // Auto-detect the language of typed input (Devanagari => Hindi) so the UI
    // reflects it instantly; the server independently confirms via
    // language_detected.
    const detected = detectLanguageFromText(trimmed);
    if (detected !== language) {
      console.log(`[LANG] Detected ${detected} from typed input, updating UI language.`);
      setLanguage(detected);
    }

    // Barge-in style: interrupt any AI playback before sending typed input
    if (status === "speaking" || status === "greeting") {
      console.log("[TEXT] Interrupting AI playback for typed message.");
      audioPlayer.stop();
      browserTTS.stop();
      audioPlayer.setActiveResponseId(null);
    }

    turnCommittedRef.current = false; // New turn, allow transcript_final to commit
    // No transcription involved for typed turns — go straight to "thinking".
    setProcessingPhase("thinking");
    setDraftText("");

    // Optimistic UI: render the user bubble immediately, then drop the server's
    // transcript_final echo via optimisticTurnRef.
    if (isConnected) {
      optimisticTurnRef.current = trimmed;
      setChatLog((prev) => [
        ...prev,
        { sender: "user", text: trimmed, timestamp: Date.now() }
      ]);
    }
    safeSendMessage({ type: "text_message", text: trimmed });
  };

  const newScreening = () => {
    audioPlayer.stop();
    browserTTS.stop();
    ttsUnavailableRef.current = false;
    lastAssistantTextRef.current = "";
    turnCommittedRef.current = false;
    optimisticTurnRef.current = null;
    setProcessingPhase("transcribing");
    setIsCallEnding(false);
    storedReportRef.current = null;
    setReportStatus("idle");
    setGeneratedReport(null);
    setChatLog([]);
    setInterimText("");
    setDraftText("");
    setSessionId(null);
    setWsError(null);
    setMicError(null);
    setAppError(null);
    resetSilenceTimer();
    setCallDuration(0);
    disconnect();
    transitionStatus("idle");
  };

  const retryReport = () => {
    setReportStatus("generating");
    setAppError(null);
    safeSendMessage({ type: "retry_report" });
  };

  const dismissError = useCallback(() => setAppError(null), []);

  return {
    isConnected,
    status,
    language,
    setLanguage,
    sessionId,
    processingPhase,
    isSpeaking: status === "speaking" || status === "greeting",
    chatLog,
    interimText,
    draftText,
    setDraftText,
    isRecording,
    reportStatus,
    generatedReport,
    appError,
    dismissError,
    callDuration,
    startCall,
    endCall,
    startRecordingTurn,
    stopRecordingTurn,
    sendText,
    newScreening,
    retryReport
  };
}

export default useCallSession;