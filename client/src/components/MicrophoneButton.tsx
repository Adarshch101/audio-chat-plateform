import type { CallStatus } from "../types/websocket";

interface MicrophoneButtonProps {
  status: CallStatus;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function MicrophoneButton({
  status,
  isRecording,
  onStartRecording,
  onStopRecording
}: MicrophoneButtonProps) {
  // Allow recording trigger during listening or active AI speaking (for barge-in)
  const canRecord = status === "listening" || status === "speaking" || status === "greeting";
  const isLocked = status === "processing" || status === "connecting" || !canRecord;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canRecord) return;
    // Release pointer capture to ensure pointerup is fired even if the pointer moves out of the element
    e.currentTarget.releasePointerCapture(e.pointerId);
    onStartRecording();
  };

  const handlePointerUp = () => {
    if (isRecording) {
      onStopRecording();
    }
  };

  const handlePointerCancel = () => {
    if (isRecording) {
      onStopRecording();
    }
  };

  const getButtonClass = () => {
    if (isLocked) {
      return "bg-white/5 text-slate-600 cursor-not-allowed border border-white/10";
    }
    if (isRecording) {
      return "bg-red-500 text-white cursor-pointer shadow-lg shadow-red-500/30 animate-pulse border border-red-400/40";
    }
    if (status === "speaking" || status === "greeting") {
      return "bg-amber-500 hover:bg-amber-400 active:bg-amber-500 text-white cursor-pointer shadow-md shadow-amber-500/20 border border-amber-400/40";
    }
    return "bg-gradient-to-br from-cyan-500 to-indigo-500 hover:opacity-90 active:opacity-80 text-white cursor-pointer shadow-md shadow-cyan-500/20 border-0";
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      disabled={!canRecord}
      aria-label={isRecording ? "Release to send your voice message" : status === "speaking" || status === "greeting" ? "Hold to interrupt the assistant" : "Hold to speak"}
      title={isRecording ? "Release to send" : status === "speaking" || status === "greeting" ? "Hold to interrupt" : "Hold to speak"}
      className={`w-11 h-11 rounded-xl flex items-center justify-center border-0 transition-all duration-150 select-none touch-none focus:outline-none focus:ring-2 focus:ring-cyan-400/60 ${getButtonClass()}`}
    >
      {isRecording ? (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}

export default MicrophoneButton;
