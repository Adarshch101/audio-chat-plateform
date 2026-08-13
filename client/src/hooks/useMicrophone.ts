import { useCallback, useRef, useState, useEffect } from "react";

interface UseMicrophoneProps {
  onAudioChunk: (base64Data: string) => void;
}

export function useMicrophone({ onAudioChunk }: UseMicrophoneProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    const stream = streamRef.current;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        // Request any remaining buffered audio before stopping
        if (mediaRecorder.state === "recording") {
          mediaRecorder.requestData();
        }
        mediaRecorder.stop();
      } catch (err) {
        console.error("Failed to stop media recorder:", err);
      }
      mediaRecorderRef.current = null;
    }

    // Give browser a short 100ms window to process ondataavailable before stopping stream tracks
    setTimeout(() => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (err) {
            console.error("Failed to stop media stream track:", err);
          }
        });
      }
    }, 100);

    streamRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      // Enable noise suppression, echo cancellation, and auto gain control for high STT recognition accuracy
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      streamRef.current = stream;

      // Identify standard codecs compatible with future STT integrations
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
        "audio/wav"
      ];

      let selectedMimeType = "";
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      console.log(`[MIC] Selected audio MIME type: ${selectedMimeType || "default browser format"}`);

      const options = selectedMimeType ? { mimeType: selectedMimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0) {
          try {
            const base64 = await blobToBase64(event.data);
            if (base64) {
              onAudioChunk(base64);
            }
          } catch (err) {
            console.error("Failed to convert audio chunk to base64:", err);
          }
        }
      };

      mediaRecorder.start(250); // Slice chunk every 250ms
      setIsRecording(true);
    } catch (err: unknown) {
      console.error("Microphone hardware access failed:", err);
      let errMsg = "Microphone access is required to use voice input. Please allow microphone access in your browser settings.";

      if (err && typeof err === "object") {
        const errorName = (err as any).name;
        if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
          errMsg = "Microphone access is required to use voice input. Please allow microphone access in your browser settings.";
        } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
          errMsg = "No audio recording device found. Please connect a microphone.";
        }
      }

      setError(errMsg);
      setIsRecording(false);
    }
  }, [onAudioChunk]);

  useEffect(() => {
    return () => {
      // Final fallback unmount cleanup
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      }
    };
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    setError
  };
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1] || "";
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default useMicrophone;
