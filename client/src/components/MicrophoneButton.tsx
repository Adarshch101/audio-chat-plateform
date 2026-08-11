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

  const getButtonContent = () => {
    if (status === "processing") {
      return (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </span>
      );
    }

    if (status === "connecting") {
      return "Connecting...";
    }

    if (isRecording) {
      return (
        <span className="flex items-center justify-center gap-2 font-bold animate-pulse text-white">
          <span className="w-2.5 h-2.5 rounded-full bg-white" />
          Release to Send
        </span>
      );
    }

    if (status === "speaking" || status === "greeting") {
      return (
        <span className="flex items-center justify-center gap-2">
          <span>🎙</span> Hold to Interrupt
        </span>
      );
    }

    return (
      <span className="flex items-center justify-center gap-2">
        <span>🎙</span> Hold to Speak
      </span>
    );
  };

  // Determine button background/border style depending on state
  const getButtonClass = () => {
    if (status === "processing" || status === "connecting") {
      return "bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed";
    }

    if (!canRecord) {
      return "bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed";
    }

    if (isRecording) {
      return "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white cursor-pointer shadow-md select-none touch-none";
    }

    if (status === "speaking" || status === "greeting") {
      return "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white cursor-pointer shadow-sm hover:shadow transition-all select-none touch-none";
    }

    return "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer shadow-sm hover:shadow transition-all select-none touch-none";
  };

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      disabled={!canRecord}
      aria-label="Microphone Interaction Button"
      className={`w-full py-4 px-6 rounded-2xl text-base font-semibold border-0 transition-all select-none duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${getButtonClass()}`}
    >
      {getButtonContent()}
    </button>
  );
}

export default MicrophoneButton;
