import { useEffect, useRef } from "react";
import type { CallStatus } from "../types/websocket";

interface UseSilenceTimerProps {
  onFirstTimeout: () => void;
  onSecondTimeout: () => void;
  status: CallStatus;
  isRecording: boolean;
  disabled?: boolean;
}

export function useSilenceTimer({
  onFirstTimeout,
  onSecondTimeout,
  status,
  isRecording,
  disabled
}: UseSilenceTimerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silencePhaseRef = useRef<number>(0); // 0 = none, 1 = first warning sent

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (durationMs: number, phase: number) => {
    clearTimer();
    console.log(`[SilenceTimer] Scheduling silence check duration=${durationMs}ms, phase=${phase}`);
    
    timerRef.current = setTimeout(() => {
      if (phase === 0) {
        console.log("[SilenceTimer] First silence timeout triggered.");
        silencePhaseRef.current = 1;
        onFirstTimeout();
        // Automatically start the second tier timer immediately
        startTimer(15000, 1);
      } else {
        console.log("[SilenceTimer] Second silence timeout triggered.");
        onSecondTimeout();
      }
    }, durationMs);
  };

  useEffect(() => {
    // Do not monitor silence while the user is actively typing a message
    if (disabled) {
      clearTimer();
      return () => clearTimer();
    }

    // We only monitor silence during listening states when the user is not actively recording
    if (status === "listening" && !isRecording) {
      // If we are already in phase 1 (warning spoken), wait for the second timeout
      if (silencePhaseRef.current === 1) {
        startTimer(15000, 1);
      } else {
        startTimer(15000, 0);
      }
    } else {
      clearTimer();
      // Reset silence tracker if user is talking or processing
      if (status === "processing" || status === "speaking" || isRecording) {
        silencePhaseRef.current = 0;
      }
    }

    return () => clearTimer();
  }, [status, isRecording, disabled]);

  const reset = () => {
    clearTimer();
    silencePhaseRef.current = 0;
  };

  return {
    reset
  };
}

export default useSilenceTimer;
