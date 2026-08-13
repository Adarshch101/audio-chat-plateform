import { useState, useRef, useEffect, useCallback } from "react";

export interface UseAudioPlayerOptions {
  onQueueDrained?: () => void;
}

interface QueuedAudio {
  url: string;
  responseId: string;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const queueRef = useRef<QueuedAudio[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Track currently active responseId
  const activeResponseIdRef = useRef<string | null>(null);
  // Track if the server has signaled audio_end
  const audioEndReceivedRef = useRef(false);
  const onQueueDrainedRef = useRef<(() => void) | null>(null);

  // Keep callback reference updated
  useEffect(() => {
    onQueueDrainedRef.current = options.onQueueDrained || null;
  }, [options.onQueueDrained]);

  const playNext = useCallback(() => {
    // If there is an active audio element playing, do nothing
    if (audioRef.current && !audioRef.current.paused) {
      return;
    }

    // Filter queue to remove any chunks not matching the active response ID
    queueRef.current = queueRef.current.filter(
      (item) => item.responseId === activeResponseIdRef.current
    );

    // If the queue is empty
    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      // If we received the audio_end message, the turn is officially complete
      if (audioEndReceivedRef.current) {
        console.log("[AudioPlayer] Playback queue drained completely.");
        audioEndReceivedRef.current = false;
        if (onQueueDrainedRef.current) {
          onQueueDrainedRef.current();
        }
      }
      return;
    }

    setIsPlaying(true);
    const { url: nextUrl } = queueRef.current.shift()!;
    const audio = new Audio(nextUrl);
    audioRef.current = audio;

    audio.play()
      .then(() => {
        audio.onended = () => {
          // Clean up URL and reference
          URL.revokeObjectURL(nextUrl);
          audioRef.current = null;
          playNext();
        };
      })
      .catch((err) => {
        console.error("[AudioPlayer] Audio playback execution error:", err);
        URL.revokeObjectURL(nextUrl);
        audioRef.current = null;
        playNext();
      });
  }, []);

  const addChunk = useCallback((base64Data: string, responseId: string) => {
    // Discard chunk if it belongs to a past/interrupted responseId
    if (activeResponseIdRef.current && responseId !== activeResponseIdRef.current) {
      console.log(`[AudioPlayer] Discarded late chunk for responseId=${responseId} (active=${activeResponseIdRef.current})`);
      return;
    }

    try {
      // Decode Base64 string to raw binary data
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Compile binary bytes into a browser playable Blob URL
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      queueRef.current.push({ url, responseId });
      
      // Trigger playback if idle
      if (!audioRef.current) {
        playNext();
      }
    } catch (err) {
      console.error("[AudioPlayer] Failed to buffer audio chunk:", err);
    }
  }, [playNext]);

  const setAudioEnd = useCallback((responseId: string) => {
    if (activeResponseIdRef.current && responseId !== activeResponseIdRef.current) {
      return;
    }

    audioEndReceivedRef.current = true;
    // If the queue is already empty and not playing, trigger drain callback immediately
    const validQueue = queueRef.current.filter((item) => item.responseId === activeResponseIdRef.current);
    if (validQueue.length === 0 && !audioRef.current) {
      console.log("[AudioPlayer] Audio end received and queue is empty, draining.");
      audioEndReceivedRef.current = false;
      if (onQueueDrainedRef.current) {
        onQueueDrainedRef.current();
      }
    }
  }, []);

  const setActiveResponseId = useCallback((id: string | null) => {
    console.log(`[AudioPlayer] Active response ID set to: ${id}`);
    activeResponseIdRef.current = id;
    
    // Invalidate queue entries that do not match the new response ID
    if (id !== null) {
      queueRef.current = queueRef.current.filter((item) => item.responseId === id);
    } else {
      queueRef.current = [];
    }
  }, []);

  const stop = useCallback(() => {
    console.log("[AudioPlayer] Stopping audio player and flushing queue...");
    
    // Stop active audio play
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
      audioRef.current = null;
    }

    // Revoke all buffered URLs
    queueRef.current.forEach((item) => {
      try {
        URL.revokeObjectURL(item.url);
      } catch {}
    });

    queueRef.current = [];
    audioEndReceivedRef.current = false;
    activeResponseIdRef.current = null;
    setIsPlaying(false);
  }, []);

  // Guarantee hardware stops on hook unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isPlaying,
    addChunk,
    setAudioEnd,
    setActiveResponseId,
    stop
  };
}
export default useAudioPlayer;
