import { useEffect, useState, useRef, useCallback } from "react";
import useWebSocket from "../hooks/useWebSocket";
import useMicrophone from "../hooks/useMicrophone";
import useAudioPlayer from "../hooks/useAudioPlayer";
import useSilenceTimer from "../hooks/useSilenceTimer";
import useBrowserTTS from "../hooks/useBrowserTTS";
import MicrophoneButton from "./MicrophoneButton";
import HealthReport from "./HealthReport";
import type { CallStatus, HealthReport as HealthReportType, ClientMessage, AppError } from "../types/websocket";

export function CallScreen() {
  const {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    lastMessage,
    error: wsError,
    setError: setWsError
  } = useWebSocket();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatLog, setChatLog] = useState<{ sender: "user" | "assistant"; text: string; timestamp: number }[]>([]);
  const [interimText, setInterimText] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Health report states
  const [reportStatus, setReportStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [generatedReport, setGeneratedReport] = useState<HealthReportType | null>(null);

  // App error states
  const [appError, setAppError] = useState<AppError | null>(null);

  // Call duration counter
  const [callDuration, setCallDuration] = useState<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for postponed reports
  const storedReportRef = useRef<HealthReportType | null>(null);
  const [isCallEnding, setIsCallEnding] = useState(false);
  const isCallEndingRef = useRef(false);

  // Browser TTS fallback (when ElevenLabs is unavailable)
  const browserTTS = useBrowserTTS();
  const ttsUnavailableRef = useRef(false);
  const lastAssistantTextRef = useRef<string>("");
  // Track processed message IDs to prevent duplicate processing in StrictMode
  const processedMessageRef = useRef<string>("");

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
    isRecording
  });

  // Auto-scroll chat windows
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, interimText, status]);

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

  // Process server events and update UI state machine
  useEffect(() => {
    if (!lastMessage) return;

    // Deduplicate: generate a fingerprint for this message to prevent double-processing in StrictMode
    const msgFingerprint = JSON.stringify(lastMessage);
    if (processedMessageRef.current === msgFingerprint) return;
    processedMessageRef.current = msgFingerprint;

    switch (lastMessage.type) {
      case "call_started":
        setSessionId(lastMessage.sessionId);
        break;
      case "status":
        // Map server status directly to state machine wrapper
        transitionStatus(lastMessage.status);
        break;
      case "assistant_message":
        lastAssistantTextRef.current = lastMessage.text;
        setChatLog((prev) => [
          ...prev,
          { sender: "assistant", text: lastMessage.text, timestamp: Date.now() }
        ]);
        break;
      case "transcript_partial":
        setInterimText(lastMessage.text);
        break;
      case "transcript_final":
        setChatLog((prev) => [
          ...prev,
          { sender: "user", text: lastMessage.text, timestamp: Date.now() }
        ]);
        setInterimText("");
        break;
      case "stt_empty":
        setChatLog((prev) => [
          ...prev,
          { sender: "assistant", text: language === "hi" ? "मुझे ठीक से समझ नहीं आया। कृपया दोबारा कहें।" : "I didn't quite catch that. Please try again.", timestamp: Date.now() }
        ]);
        setInterimText("");
        break;

      // Audio stream events
      case "audio_start":
        audioPlayer.setActiveResponseId(lastMessage.responseId);
        transitionStatus("speaking");
        break;
      case "audio_chunk":
        audioPlayer.addChunk(lastMessage.data, lastMessage.responseId);
        break;
      case "audio_end":
        audioPlayer.setAudioEnd(lastMessage.responseId);
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
        if (audioPlayer.isPlaying) {
          storedReportRef.current = lastMessage.report;
          setIsCallEnding(true);
        } else {
          setGeneratedReport(lastMessage.report);
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
            message: lastMessage.message,
            recoverable: true
          });
        }
        break;
      default:
        break;
    }
  }, [lastMessage, disconnect, stopRecording, audioPlayer, language]);

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

  const handleStartCall = () => {
    audioPlayer.stop();
    browserTTS.stop();
    ttsUnavailableRef.current = false;
    lastAssistantTextRef.current = "";
    processedMessageRef.current = "";
    setIsCallEnding(false);
    storedReportRef.current = null;
    setReportStatus("idle");
    setGeneratedReport(null);
    setChatLog([]);
    setInterimText("");
    setSessionId(null);
    setWsError(null);
    setMicError(null);
    setAppError(null);
    resetSilenceTimer();
    setCallDuration(0);
    transitionStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    connect(`${protocol}//${host}:5000`);
  };

  const handleEndCall = () => {
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
  const handleStartRecording = () => {
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
      startRecording();
    }
  };

  const handleStopRecording = () => {
    stopRecording();
    safeSendMessage({ type: "end_turn" });
  };

  const handleNewScreening = () => {
    audioPlayer.stop();
    browserTTS.stop();
    ttsUnavailableRef.current = false;
    lastAssistantTextRef.current = "";
    processedMessageRef.current = "";
    setIsCallEnding(false);
    storedReportRef.current = null;
    setReportStatus("idle");
    setGeneratedReport(null);
    setChatLog([]);
    setInterimText("");
    setSessionId(null);
    setWsError(null);
    setMicError(null);
    setAppError(null);
    resetSilenceTimer();
    setCallDuration(0);
    disconnect();
    transitionStatus("idle");
  };

  // Duration parser
  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper formats for status indicators
  const getStatusBadge = () => {
    switch (status) {
      case "idle":
        return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Disconnected</span>;
      case "connecting":
        return (
          <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Connecting...
          </span>
        );
      case "greeting":
        return (
          <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            AI Greeting
          </span>
        );
      case "listening":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            {isRecording ? "Recording" : "Listening"}
          </span>
        );
      case "processing":
        return (
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Processing...
          </span>
        );
      case "speaking":
        return (
          <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Speaking
          </span>
        );
      case "generating_report":
        return <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Analyzing Report</span>;
      case "ended":
        return <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Call Ended</span>;
      case "error":
        return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">Error</span>;
      default:
        return null;
    }
  };

  // Render report generating loader screen
  if (reportStatus === "generating") {
    return (
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 p-12 flex flex-col items-center justify-center min-h-[380px] animate-fadeIn">
        <div className="flex flex-col items-center gap-6 text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Generating Health Report</h2>
            <p className="text-sm text-slate-400 mt-2 px-4 leading-relaxed">Analyzing intake dialogue variables. Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render report failed screen with retry action
  if (reportStatus === "failed") {
    return (
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 p-10 flex flex-col items-center justify-center min-h-[380px] animate-fadeIn">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-3xl font-bold">
            !
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Report Generation Failed</h2>
            <p className="text-sm text-slate-500 mt-2.5 px-4 leading-relaxed">
              We couldn't generate the full screening report. The variables collected during your call could not be compiled.
            </p>
          </div>
          <div className="w-full flex gap-3 mt-6">
            <button
              onClick={() => {
                setReportStatus("generating");
                setAppError(null);
                safeSendMessage({ type: "retry_report" });
              }}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </button>
            <button
              onClick={handleNewScreening}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render final report dashboard screen
  if (reportStatus === "ready" && generatedReport) {
    return (
      <HealthReport
        report={generatedReport}
        transcript={chatLog}
        onNewScreening={handleNewScreening}
      />
    );
  }

  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-100 p-8 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI Health Screening</h1>
          <p className="text-xs text-slate-400">Voice Assistant with Intake Report</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {getStatusBadge()}
          {callDuration > 0 && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Duration: {formatDuration(callDuration)}
            </span>
          )}
        </div>
      </div>

      {/* Connection Info */}
      {sessionId && (
        <div className="mb-4 bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-500 break-all">
          <span className="font-semibold text-slate-700">Session ID:</span> {sessionId}
        </div>
      )}

      {/* App Errors Model Display Alert */}
      {appError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 flex flex-col gap-2 transition-all">
          <div className="flex justify-between items-center">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-red-100 px-2 py-0.5 rounded text-red-800">
              {appError.code}
            </span>
            {appError.recoverable && (
              <span className="text-[10px] text-red-500 font-semibold italic">Recoverable</span>
            )}
          </div>
          <p className="text-xs text-red-600 font-medium leading-relaxed">{appError.message}</p>
          
          <div className="flex gap-2 mt-1">
            {appError.code === "WEBSOCKET_ERROR" && (
              <button
                onClick={handleStartCall}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-bold text-xs shadow-sm transition-all focus:outline-none"
              >
                Reconnect
              </button>
            )}
            {appError.code === "REPORT_ERROR" && (
              <button
                onClick={() => {
                  setReportStatus("generating");
                  setAppError(null);
                  safeSendMessage({ type: "retry_report" });
                }}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-bold text-xs shadow-sm transition-all focus:outline-none"
              >
                Retry Report
              </button>
            )}
            <button
              onClick={() => setAppError(null)}
              className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-xs transition-all focus:outline-none"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Safety Warning Urgent Card */}
      {status === "ended" && chatLog.some(log => log.sender === "assistant" && (log.text.includes("emergency") || log.text.includes("तुरंत"))) && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 leading-relaxed font-semibold flex flex-col gap-1.5 animate-fadeIn">
          <span className="uppercase tracking-wider text-[10px] bg-red-100 px-2 py-0.5 rounded text-red-800 self-start">Urgent Notice</span>
          <span>Some symptoms described may require prompt medical attention. Please consider contacting an appropriate healthcare professional or emergency service.</span>
        </div>
      )}

      {/* Screen Messages Log */}
      <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto border border-slate-100 rounded-xl p-4 bg-slate-50 mb-6 flex flex-col gap-3">
        {chatLog.length === 0 && !interimText && status === "listening" && !isRecording ? (
          <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-400 italic text-center gap-1">
            <span className="text-base font-semibold text-slate-500 not-italic">Listening</span>
            <span>Hold the microphone button and speak.</span>
          </div>
        ) : (
          <>
            {chatLog.map((turn, i) => (
              <div
                key={i}
                className={`flex flex-col max-w-[85%] ${
                  turn.sender === "user" ? "self-end items-end" : "self-start items-start"
                }`}
              >
                <span className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wide px-1">
                  {turn.sender === "user" ? "You" : "AI"}
                </span>
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    turn.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            ))}

            {/* Speaking / Interim Preview text bubble */}
            {isRecording && interimText && (
              <div className="flex flex-col max-w-[85%] self-end items-end">
                <span className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wide px-1">
                  You (Speaking...)
                </span>
                <div className="p-3 rounded-2xl text-sm leading-relaxed shadow-sm bg-blue-50 text-blue-800 rounded-tr-none italic border border-blue-100 animate-pulse">
                  "{interimText}"
                </div>
              </div>
            )}

            {/* Processing state indicator bubble */}
            {status === "processing" && (
              <div className="flex flex-col max-w-[85%] self-end items-end">
                <span className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wide px-1">
                  You
                </span>
                <div className="p-3 rounded-2xl text-sm leading-relaxed shadow-sm bg-slate-50 text-slate-500 rounded-tr-none italic border border-slate-200 flex items-center gap-1.5">
                  <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing speech...
                </div>
              </div>
            )}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Language Selection & Privacy Notice Panel */}
      {(status === "idle" || status === "ended") && (
        <>
          {/* Privacy Screening Disclaimer Notice */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] text-slate-500 leading-relaxed mb-4 font-medium">
            <strong>Screening Demo Privacy Notice:</strong> This application streams voice audio to Deepgram for STT, OpenAI for conversational decisions, and ElevenLabs for TTS to generate structured intake reports. It does not provide medical diagnoses. Please avoid sharing real highly sensitive personal identifiers.
          </div>

          {/* Accessible Language Selector */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 mb-6">
            <span className="text-sm font-semibold text-slate-600" id="lang-select-label">Choose Language:</span>
            <div className="flex gap-2" role="radiogroup" aria-labelledby="lang-select-label">
              <button
                onClick={() => setLanguage("en")}
                aria-checked={language === "en"}
                role="radio"
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  language === "en"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100/50"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage("hi")}
                aria-checked={language === "hi"}
                role="radio"
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  language === "hi"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100/50"
                }`}
              >
                हिन्दी (Hindi)
              </button>
            </div>
          </div>
        </>
      )}

      {/* Microphone / PTT Interaction Panel */}
      {!(status === "idle" || status === "ended" || status === "error") && (
        <div className="mb-6 flex flex-col items-center">
          <MicrophoneButton
            status={status}
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
          
          {/* Speaking indicator and waveform */}
          {(status === "speaking" || status === "greeting") && (
            <div className="mt-3 text-xs text-slate-500 font-semibold text-center italic">
              🔊 AI is speaking...<br />
              <span className="font-normal text-slate-400 text-[10px]">Press & hold microphone button to barge-in/interrupt.</span>
            </div>
          )}

          {/* Listening waveform indicator */}
          {isRecording && (
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <div className="flex gap-1 justify-center items-center h-4 my-1">
                <span className="w-1 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-3.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                <span className="w-1 h-3.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "450ms" }} />
                <span className="w-1 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "600ms" }} />
              </div>
              <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">🔴 Listening to you...</span>
            </div>
          )}
          
          {status === "processing" && (
            <div className="mt-3 text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
              Processing your response...
            </div>
          )}

          {status === "listening" && !isRecording && (
            <div className="mt-3 text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              🎙 Listening...
            </div>
          )}
        </div>
      )}

      {/* Call Actions */}
      <div className="flex flex-col gap-3">
        {status === "idle" || status === "ended" || status === "error" ? (
          <button
            onClick={handleStartCall}
            aria-label={status === "ended" ? "Start New Screening Session" : "Start Screening Session"}
            className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 tracking-wide uppercase text-xs"
          >
            {status === "ended" ? "Start New Screening" : "Start Call"}
          </button>
        ) : (
          <button
            onClick={handleEndCall}
            aria-label="End Current Screening Session"
            className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 tracking-wide uppercase text-xs"
          >
            End Call
          </button>
        )}
      </div>
    </div>
  );
}

export default CallScreen;
