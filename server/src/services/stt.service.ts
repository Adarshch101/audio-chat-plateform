import { createClient, LiveClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export class SpeechToTextService {
  private client: LiveClient | null = null;
  private apiKey: string;
  private isConnected: boolean = false;
  private finalTranscriptBuffer: string[] = [];

  // Turn synchronization states
  private onFinalResultCallback: ((text: string) => void) | null = null;
  private isWaitingForFinal: boolean = false;
  private finalCheckTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || "";
  }

  public isAvailable(): boolean {
    return !!this.apiKey;
  }

  public createStream(
    language: "en" | "hi",
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

    this.finalTranscriptBuffer = [];
    this.isConnected = false;

    try {
      const deepgram = createClient(this.apiKey);
      const languageCode = language === "hi" ? "hi" : "en-US";

      console.log(`[STT] Opening Deepgram connection for language: ${languageCode}`);

      this.client = deepgram.listen.live({
        model: "nova-2",
        language: languageCode,
        smart_format: true,
        interim_results: true,
        punctuation: true
      });

      this.client.on(LiveTranscriptionEvents.Open, () => {
        console.log("[STT] Connected to Deepgram.");
        this.isConnected = true;
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
          onTranscriptFinal(transcript);

          // Resolve turn synchronization promise if waiting
          if (this.isWaitingForFinal && this.onFinalResultCallback) {
            this.triggerFinalCallback();
          }
        } else {
          console.log(`[STT] Interim: "${transcript}"`);
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
      });

    } catch (err: unknown) {
      console.error("[STT] Failed to create Deepgram client:", err);
      onError(err);
    }
  }

  public sendAudioChunk(buffer: Buffer) {
    if (this.client && this.isConnected) {
      try {
        this.client.send(buffer as any);
      } catch (err: unknown) {
        console.error("[STT] Failed to send audio chunk to Deepgram:", err);
      }
    } else {
      console.warn("[STT] Cannot forward chunk: Deepgram connection is not open.");
    }
  }

  public finishStream() {
    if (this.client) {
      console.log("[STT] Closing Deepgram stream...");
      try {
        this.client.finish();
      } catch (err: unknown) {
        console.error("[STT] Error closing Deepgram stream:", err);
      }
      this.client = null;
    }
    this.isConnected = false;
    this.clearFinalTimeout();
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
    return this.finalTranscriptBuffer.join(" ").trim();
  }

  private clearFinalTimeout() {
    if (this.finalCheckTimeout) {
      clearTimeout(this.finalCheckTimeout);
      this.finalCheckTimeout = null;
    }
  }

  public clearBuffer() {
    this.finalTranscriptBuffer = [];
    this.clearFinalTimeout();
    this.isWaitingForFinal = false;
    this.onFinalResultCallback = null;
  }
}
