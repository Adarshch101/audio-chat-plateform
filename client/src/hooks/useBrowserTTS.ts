import { useCallback, useRef } from "react";

/**
 * Browser-based TTS fallback using the Web Speech API.
 * Used when ElevenLabs is unavailable (free tier, API errors, etc.)
 */
export function useBrowserTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false);

  const speak = useCallback((text: string, language: "en" | "hi", onEnd?: () => void) => {
    if (!window.speechSynthesis) {
      console.warn("[BrowserTTS] SpeechSynthesis API not available in this browser.");
      onEnd?.();
      return;
    }

    // Cancel any currently playing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "hi" ? "hi-IN" : "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to find a suitable voice for the language
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = language === "hi" ? "hi" : "en";
    const matchingVoice = voices.find(v => v.lang.startsWith(langPrefix));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true;
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      utteranceRef.current = null;
      onEnd?.();
    };

    utterance.onerror = (event) => {
      console.error("[BrowserTTS] Speech synthesis error:", event.error);
      isSpeakingRef.current = false;
      utteranceRef.current = null;
      onEnd?.();
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    utteranceRef.current = null;
  }, []);

  return { speak, stop, isSpeaking: isSpeakingRef };
}

export default useBrowserTTS;
