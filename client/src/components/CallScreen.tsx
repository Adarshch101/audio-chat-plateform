import { useEffect, useRef } from "react";
import useCallSession from "../hooks/useCallSession";
import MicrophoneButton from "./MicrophoneButton";
import HealthReport from "./HealthReport";
import Spinner from "./Spinner";

// View-only: renders the call UI and delegates every piece of interaction
// state/orchestration to the useCallSession controller hook.
export function CallScreen() {
  const {
    status,
    language,
    setLanguage,
    sessionId,
    processingPhase,
    isSpeaking,
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
  } = useCallSession();

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat windows
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, interimText, status]);

  // Duration parser (view helper)
  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Helper formats for status indicators
  const getStatusBadge = () => {
    const base = "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border";
    switch (status) {
      case "idle":
        return <span className={`${base} bg-white/5 border-white/10 text-slate-400`}>Disconnected</span>;
      case "connecting":
        return (
          <span className={`${base} bg-amber-400/10 border-amber-400/30 text-amber-300`}>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Connecting...
          </span>
        );
      case "greeting":
        return (
          <span className={`${base} bg-fuchsia-400/10 border-fuchsia-400/30 text-fuchsia-300`}>
            <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
            AI Greeting
          </span>
        );
      case "listening":
        return (
          <span className={`${base} bg-emerald-400/10 border-emerald-400/30 text-emerald-300`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {isRecording ? "Recording" : "Listening"}
          </span>
        );
      case "processing":
        return (
          <span className={`${base} bg-cyan-400/10 border-cyan-400/30 text-cyan-300`}>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            {processingPhase === "transcribing" ? "Transcribing..." : "Thinking..."}
          </span>
        );
      case "speaking":
        return (
          <span className={`${base} bg-indigo-400/10 border-indigo-400/30 text-indigo-300`}>
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Speaking
          </span>
        );
      case "generating_report":
        return <span className={`${base} bg-white/5 border-white/10 text-slate-400`}>Analyzing Report</span>;
      case "ended":
        return <span className={`${base} bg-white/5 border-white/10 text-slate-400`}>Call Ended</span>;
      case "error":
        return <span className={`${base} bg-red-400/10 border-red-400/30 text-red-300`}>Error</span>;
      default:
        return null;
    }
  };

  // Render report generating loader screen
  if (reportStatus === "generating") {
    return (
      <div className="w-full h-full glass rounded-3xl p-12 flex flex-col items-center justify-center min-h-[380px] animate-fadeIn shadow-2xl">
        <div className="flex flex-col items-center gap-6 text-center">
          <Spinner size={48} className="text-cyan-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Generating Health Report</h2>
            <p className="text-sm text-slate-400 mt-2 px-4 leading-relaxed">Analyzing intake dialogue variables. Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render report failed screen with retry action
  if (reportStatus === "failed") {
    return (
      <div className="w-full h-full glass rounded-3xl p-10 flex flex-col items-center justify-center min-h-[380px] animate-fadeIn shadow-2xl">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-full bg-red-400/10 border border-red-400/30 flex items-center justify-center text-red-300 text-3xl font-bold">
            !
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Report Generation Failed</h2>
            <p className="text-sm text-slate-400 mt-2.5 px-4 leading-relaxed">
              We couldn't generate the full screening report. The variables collected during your call could not be compiled.
            </p>
          </div>
          <div className="w-full flex gap-3 mt-6">
            <button
              onClick={retryReport}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 active:opacity-80 text-white font-bold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            >
              Try Again
            </button>
            <button
              onClick={newScreening}
              className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-200 font-bold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-white/20"
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
        onNewScreening={newScreening}
      />
    );
  }

  return (
    <div className="w-full h-full min-h-0 glass rounded-3xl p-5 sm:p-6 flex flex-col shadow-2xl animate-fadeIn overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex justify-between items-center gap-3 mb-4">
        {getStatusBadge()}
        <div className="flex items-center gap-2">
          {callDuration > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 bg-white/5 border border-white/10">
              {formatDuration(callDuration)}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-slate-300">
            {language === "hi" ? "हिन्दी" : "English"}
          </span>
        </div>
      </div>

      {/* App Errors Model Display Alert */}
      {appError && (
        <div className="shrink-0 mb-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-xl p-4 flex flex-col gap-2 transition-all">
          <div className="flex justify-between items-center">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-red-400/20 px-2 py-0.5 rounded text-red-300">
              {appError.code}
            </span>
            {appError.recoverable && (
              <span className="text-[10px] text-red-300/70 font-semibold italic">Recoverable</span>
            )}
          </div>
          <p className="text-xs text-red-200/90 font-medium leading-relaxed">{appError.message}</p>

          <div className="flex gap-2 mt-1">
            {appError.code === "WEBSOCKET_ERROR" && (
              <button
                onClick={startCall}
                className="px-3 py-1 bg-red-500 hover:bg-red-400 text-white rounded-lg font-bold text-xs transition-all focus:outline-none"
              >
                Reconnect
              </button>
            )}
            {appError.code === "REPORT_ERROR" && (
              <button
                onClick={retryReport}
                className="px-3 py-1 bg-red-500 hover:bg-red-400 text-white rounded-lg font-bold text-xs transition-all focus:outline-none"
              >
                Retry Report
              </button>
            )}
            <button
              onClick={dismissError}
              className="px-3 py-1 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg font-bold text-xs transition-all focus:outline-none"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Safety Warning Urgent Card */}
      {status === "ended" && chatLog.some(log => log.sender === "assistant" && (log.text.includes("emergency") || log.text.includes("तुरंत"))) && (
        <div className="shrink-0 mb-4 bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-xs text-red-200 leading-relaxed font-semibold flex flex-col gap-1.5 animate-fadeIn">
          <span className="uppercase tracking-wider text-[10px] bg-red-400/20 px-2 py-0.5 rounded text-red-300 self-start">Urgent Notice</span>
          <span>Some symptoms described may require prompt medical attention. Please consider contacting an appropriate healthcare professional or emergency service.</span>
        </div>
      )}

      {/* Screen Messages Log */}
      <div className="flex-1 min-h-0 overflow-y-auto border border-white/10 rounded-xl p-4 bg-slate-950/60 mb-4 flex flex-col gap-3">
        {chatLog.length === 0 && !interimText ? (
          status === "idle" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
              <span className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-400">Ready when you are</p>
                <p className="text-xs text-slate-500 mt-0.5">Press Start Call to begin the screening.</p>
              </div>
            </div>
          ) : status === "listening" && !isRecording ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-slate-500 italic text-center gap-1">
              <span className="text-base font-semibold text-slate-400 not-italic">Listening</span>
              <span>Hold the mic and speak, or type your response below.</span>
            </div>
          ) : null
        ) : (
          <>
            {chatLog.map((turn, i) => (
              <div
                key={i}
                className={`flex flex-col max-w-[85%] ${
                  turn.sender === "user" ? "self-end items-end" : "self-start items-start"
                }`}
              >
                <span className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide px-1">
                  {turn.sender === "user" ? "You" : "AI"}
                </span>
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    turn.sender === "user"
                      ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white rounded-tr-none"
                      : "bg-white/5 text-slate-200 border border-white/10 rounded-tl-none"
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            ))}

            {/* Speaking / Interim Preview text bubble */}
            {isRecording && interimText && (
              <div className="flex flex-col max-w-[85%] self-end items-end">
                <span className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide px-1">
                  You (Speaking...)
                </span>
                <div className="p-3 rounded-2xl text-sm leading-relaxed bg-cyan-400/10 text-cyan-200 rounded-tr-none italic border border-cyan-400/20 animate-pulse">
                  "{interimText}"
                </div>
              </div>
            )}

            {/* Processing state indicator bubble */}
            {status === "processing" && (
              <div className="flex flex-col max-w-[85%] self-end items-end">
                <span className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wide px-1">
                  You
                </span>
                <div className="p-3 rounded-2xl text-sm leading-relaxed bg-white/5 text-slate-300 rounded-tr-none italic border border-white/10 flex items-center gap-1.5">
                  <svg className="animate-spin h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {processingPhase === "transcribing" ? "Transcribing your speech..." : "Thinking about your response..."}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Language Selector */}
      {(status === "idle" || status === "ended") && (
        <div className="shrink-0 flex items-center justify-center gap-3 mb-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider" id="lang-select-label">
            Language
          </span>
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1" role="radiogroup" aria-labelledby="lang-select-label">
            <button
              onClick={() => setLanguage("en")}
              aria-checked={language === "en"}
              role="radio"
              className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${
                language === "en"
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage("hi")}
              aria-checked={language === "hi"}
              role="radio"
              className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${
                language === "hi"
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              हिन्दी (Hindi)
            </button>
          </div>
        </div>
      )}

      {/* Microphone / PTT Interaction Panel */}
      {!(status === "idle" || status === "ended" || status === "error") && (
        <div className="shrink-0 mb-5 flex flex-col gap-2.5">
          {/* Typed response + Send + mic inline */}
          <div className="w-full flex items-center gap-2">
            <input
              type="text"
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendText();
                }
              }}
              placeholder={language === "hi" ? "अपना उत्तर यहाँ टाइप करें…" : "Type your response…"}
              disabled={isRecording || status === "processing" || status === "connecting" || status === "generating_report"}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendText}
              disabled={!draftText.trim() || isRecording || status === "processing" || status === "connecting" || status === "generating_report"}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 active:opacity-80 text-white font-bold rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
            <MicrophoneButton
              status={status}
              isRecording={isRecording}
              onStartRecording={startRecordingTurn}
              onStopRecording={stopRecordingTurn}
            />
          </div>

          {/* Status indicators strip */}
          <div className="min-h-[18px] flex flex-col items-center justify-center gap-1">
            {isSpeaking && (
              <div className="text-xs text-slate-400 font-semibold text-center">
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" aria-hidden="true">
                    <path d="M3 10v4h4l5 5V5L7 10H3z" />
                    <path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" opacity="0.6" />
                  </svg>
                  AI is speaking... <span className="italic text-slate-500">hold the mic to barge-in</span>
                </span>
              </div>
            )}

            {isRecording && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex gap-1 justify-center items-center h-4">
                  <span className="w-1 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-3.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="w-1 h-3.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "450ms" }} />
                  <span className="w-1 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: "600ms" }} />
                </div>
                <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider">Listening to you — release to send</span>
              </div>
            )}

            {!isRecording && !isSpeaking && status === "processing" && (
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                {processingPhase === "transcribing" ? "Transcribing..." : "Thinking..."}
              </div>
            )}

            {!isRecording && status === "listening" && (
              <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Listening — hold the mic to talk, or type below
              </div>
            )}
          </div>
        </div>
      )}

      {/* Call Actions */}
      <div className="shrink-0 flex flex-col gap-3">
        {status === "idle" || status === "ended" || status === "error" ? (
          <button
            onClick={startCall}
            aria-label={status === "ended" ? "Start New Screening Session" : "Start Screening Session"}
            className="glow w-full py-3.5 px-6 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 active:opacity-80 text-white font-bold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/60 tracking-wide uppercase text-xs"
          >
            {status === "ended" ? "Start New Screening" : "Start Call"}
          </button>
        ) : (
          <button
            onClick={endCall}
            aria-label="End Current Screening Session"
            className="w-full py-3.5 px-6 bg-red-500 hover:bg-red-400 active:bg-red-500 text-white font-bold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-400/60 tracking-wide uppercase text-xs"
          >
            End Call
          </button>
        )}
      </div>

      {/* Session ID */}
      {sessionId && (
        <p className="shrink-0 mt-4 text-[10px] font-mono text-slate-600 text-center truncate" title={sessionId}>
          Session · {sessionId}
        </p>
      )}
    </div>
  );
}

export default CallScreen;