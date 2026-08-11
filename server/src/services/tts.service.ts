import { Readable } from "stream";

export class TextToSpeechService {
  private apiKey: string = "";
  private englishVoiceId: string = "";
  private hindiVoiceId: string = "";
  private initialized: boolean = false;

  private ensureInit() {
    if (this.initialized) return;
    this.initialized = true;
    this.apiKey = process.env.ELEVENLABS_API_KEY || "";
    
    // Support language-specific voice fallbacks
    const defaultVoice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // default 'Rachel' voice
    this.englishVoiceId = process.env.ELEVENLABS_ENGLISH_VOICE_ID || defaultVoice;
    this.hindiVoiceId = process.env.ELEVENLABS_HINDI_VOICE_ID || defaultVoice;
  }

  public isAvailable(): boolean {
    this.ensureInit();
    return !!this.apiKey;
  }

  /**
   * Generates a streaming MP3 audio output from ElevenLabs based on targeted language and text
   */
  public async generateSpeechStream(
    text: string,
    language: "en" | "hi",
    signal?: AbortSignal
  ): Promise<Readable> {
    this.ensureInit();

    // Chaos simulation hook
    if (process.env.SIMULATE_TTS_FAILURE === "true") {
      console.warn("[CHAOS] Simulating ElevenLabs audio generation API drop.");
      throw new Error("[CHAOS] Simulated ElevenLabs failure.");
    }

    if (!this.apiKey) {
      throw new Error("ElevenLabs xi-api-key is not configured.");
    }

    const voiceId = language === "hi" ? this.hindiVoiceId : this.englishVoiceId;
    const modelId = language === "hi" ? "eleven_multilingual_v2" : "eleven_monolingual_v1";

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`;

    console.log(`[TTS] Requesting voice stream using voice=${voiceId}, model=${modelId} for language=${language}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        "accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }),
      signal // Connect abort signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API returned status ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error("ElevenLabs response body stream is missing.");
    }

    // Convert Web ReadableStream to Node Readable
    return Readable.fromWeb(response.body as any);
  }
}
export default TextToSpeechService;
