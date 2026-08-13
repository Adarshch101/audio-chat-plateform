import { createClient, LiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";

type SttLanguageCode = "en" | "hi" | "multi";
type SttModelName = "nova-2" | "nova-3";

interface SttConfig {
  model: SttModelName;
  language: SttLanguageCode;
}

function resolveSttConfig(): SttConfig {
  const modelInput = (process.env.STT_MODEL || "nova-3").trim();
  const model: SttModelName = modelInput === "nova-2" ? "nova-2" : "nova-3";

  // "multi" enables in-stream language auto-detection (English + Hindi via
  // Nova-3's real-time code switching). Pin to "en" or "hi" to disable it.
  const languageInput = (process.env.STT_LANGUAGE || "multi").trim();
  const language: SttLanguageCode =
    languageInput === "en" || languageInput === "hi" ? languageInput : "multi";

  return { model, language };
}

export class SpeechToTextService {
  private client: LiveClient | null = null;
  private apiKey: string;
  private isConnected: boolean = false;
  private finalTranscriptBuffer: string[] = [];
  private lastInterimTranscript: string = "";
  private isSessionActive: boolean = false;

  // Turn synchronization states
  private onFinalResultCallback: ((text: string) => void) | null = null;
  private isWaitingForFinal: boolean = false;
  private finalCheckTimeout: NodeJS.Timeout | null = null;

  // Reconnect support: store stream config so we can recreate on drop
  private lastOnPartial: ((text: string) => void) | null = null;
  private lastOnFinal: ((text: string) => void) | null = null;
  private lastOnError: ((err: unknown) => void) | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || "";
  }

  public isAvailable(): boolean {
    return !!this.apiKey;
  }

  public getConnectionStatus(): string {
    return `connected=${this.isConnected}, hasClient=${!!this.client}, sessionActive=${this.isSessionActive}`;
  }

  public createStream(
    _language: "en" | "hi",
    onTranscriptPartial: (text: string) => void,
    onTranscriptFinal: (text: string) => void,
    onError: (err: unknown) => void
  ) {
    if (!this.apiKey) {
      throw new Error("DEEPGRAM_API_KEY is not configured.");
    }

    // Chaos simulation hook
    if (process.env.SIMULATE_STT_FAILURE === "true") {
      console.warn("[CHAOS] Simulating Deepgram connection failure.");
      setTimeout(() => {
        onError(new Error("[CHAOS] Simulated Deepgram failure."));
      }, 500);
      return;
    }

    // The stream is configured with the resolved STT model/language (see
    // resolveSttConfig below). The caller-supplied language only seeds the
    // session's initial greeting; spoken input is auto-detected in-stream.
    const config = resolveSttConfig();

    // Store config for reconnection
    this.lastOnPartial = onTranscriptPartial;
    this.lastOnFinal = onTranscriptFinal;
    this.lastOnError = onError;

    this.finalTranscriptBuffer = [];
    this.isConnected = false;
    this.isSessionActive = true;

    this.initConnection(config, onTranscriptPartial, onTranscriptFinal, onError);
  }

  private initConnection(
    config: SttConfig,
    onTranscriptPartial: (text: string) => void,
    onTranscriptFinal: (text: string) => void,
    onError: (err: unknown) => void
  ) {
    // Clean up any existing connection
    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.finish();
      } catch (e) {}
      this.client = null;
    }
    this.stopKeepAlive();

    try {
      const deepgram = createClient(this.apiKey);

      console.log(`[STT] Opening Deepgram connection with model=${config.model}, language=${config.language}`);

      this.client = deepgram.listen.live({
        model: config.model,
        language: config.language,
        smart_format: true,
        interim_results: true,
        punctuation: true,
        // Short endpointing helps the multilingual model segment utterances
        // quickly so language switching is picked up turn-by-turn.
        endpointing: config.language === "multi" ? 100 : undefined
      });

      this.client.on(LiveTranscriptionEvents.Open, () => {
        console.log("[STT] Connected to Deepgram.");
        this.isConnected = true;
        this.startKeepAlive();
      });

      this.client.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alternatives = data.channel?.alternatives;
        if (!alternatives || alternatives.length === 0) return;

        const transcript = alternatives[0].transcript || "";
        const isFinal = data.is_final || false;

        if (transcript.trim() === "") return;

        if (isFinal) {
          console.log(`[STT] Final: "${transcript}"`);
          this.finalTranscriptBuffer.push(transcript);
          this.lastInterimTranscript = ""; // Clear interim once finalized
          onTranscriptFinal(transcript);

          // Resolve turn synchronization promise if waiting
          if (this.isWaitingForFinal && this.onFinalResultCallback) {
            this.triggerFinalCallback();
          }
        } else {
          console.log(`[STT] Interim: "${transcript}"`);
          this.lastInterimTranscript = transcript;
          onTranscriptPartial(transcript);
        }
      });

      this.client.on(LiveTranscriptionEvents.Error, (err: unknown) => {
        console.error("[STT] Deepgram connection error:", err);
        onError(err);
      });

      this.client.on(LiveTranscriptionEvents.Close, () => {
        console.log("[STT] Deepgram connection closed.");
        this.isConnected = false;
        this.client = null;
        this.stopKeepAlive();

        // Auto-reconnect if the session is still active
        if (this.isSessionActive) {
          console.log("[STT] Session still active — scheduling auto-reconnect in 1s...");
          this.scheduleReconnect();
        }
      });

    } catch (err: unknown) {
      console.error("[STT] Failed to create Deepgram client:", err);
      onError(err);
    }
  }

  /** Send periodic keepAlive messages to prevent Deepgram idle timeout */
  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.client && this.isConnected) {
        try {
          this.client.keepAlive();
        } catch (e) {
          console.warn("[STT] KeepAlive send failed:", e);
        }
      }
    }, 8000); // Send keepAlive every 8 seconds
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  /** Schedule a reconnection attempt */
  private scheduleReconnect() {
    if (this.reconnectTimer) return; // Already scheduled
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isSessionActive && !this.isConnected && this.lastOnPartial && this.lastOnFinal && this.lastOnError) {
        console.log("[STT] Auto-reconnecting to Deepgram...");
        this.initConnection(resolveSttConfig(), this.lastOnPartial, this.lastOnFinal, this.lastOnError);
      }
    }, 1000);
  }

  public sendAudioChunk(buffer: Buffer) {
    if (this.client && this.isConnected) {
      try {
        this.client.send(buffer as any);
      } catch (err: unknown) {
        console.error("[STT] Failed to send audio chunk to Deepgram:", err);
      }
    } else if (this.isSessionActive) {
      // Connection dropped — trigger reconnect if not already scheduled
      if (!this.reconnectTimer) {
        console.warn("[STT] Connection not open. Triggering reconnect...");
        this.scheduleReconnect();
      }
    } else {
      console.warn("[STT] Cannot forward chunk: Deepgram connection is not open.");
    }
  }

  public finishStream() {
    this.isSessionActive = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopKeepAlive();
    if (this.client) {
      console.log("[STT] Closing Deepgram stream...");
      try {
        this.client.removeAllListeners();
        this.client.finish();
      } catch (err: unknown) {
        console.error("[STT] Error closing Deepgram stream:", err);
      }
      this.client = null;
    }
    this.isConnected = false;
    this.clearFinalTimeout();
    // Clear stored callbacks
    this.lastOnPartial = null;
    this.lastOnFinal = null;
    this.lastOnError = null;
  }

  /**
   * Helper to wait for the final transcript segment before completing user turn
   */
  public async waitForFinalResult(timeoutMs: number = 2000): Promise<string> {
    if (!this.client || !this.isConnected) {
      return this.getMergedBuffer();
    }

    return new Promise((resolve) => {
      this.isWaitingForFinal = true;

      // Define callback that resolves the promise
      this.onFinalResultCallback = (completedText) => {
        resolve(completedText);
      };

      // Set fallback timeout so we don't block indefinitely
      this.finalCheckTimeout = setTimeout(() => {
        console.log("[STT] Turn wait timeout reached, compiling current buffer...");
        this.triggerFinalCallback();
      }, timeoutMs);
    });
  }

  private triggerFinalCallback() {
    this.clearFinalTimeout();
    this.isWaitingForFinal = false;
    const finalResult = this.getMergedBuffer();
    if (this.onFinalResultCallback) {
      this.onFinalResultCallback(finalResult);
      this.onFinalResultCallback = null;
    }
  }

  private getMergedBuffer(): string {
    const merged = this.finalTranscriptBuffer.join(" ").trim();
    if (merged !== "") {
      return merged;
    }
    // Fallback: if no is_final was received, return the latest interim transcript
    if (this.lastInterimTranscript.trim() !== "") {
      console.log(`[STT] Using interim transcript fallback: "${this.lastInterimTranscript}"`);
      return this.lastInterimTranscript.trim();
    }
    return "";
  }

  private clearFinalTimeout() {
    if (this.finalCheckTimeout) {
      clearTimeout(this.finalCheckTimeout);
      this.finalCheckTimeout = null;
    }
  }

  public clearBuffer() {
    this.finalTranscriptBuffer = [];
    this.lastInterimTranscript = "";
    this.clearFinalTimeout();
    this.isWaitingForFinal = false;
    this.onFinalResultCallback = null;
  }
}

