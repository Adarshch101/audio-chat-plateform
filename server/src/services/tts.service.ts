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
    
    // Support language-specific voice fallbacks (using standard free premade voice ID)
    const defaultVoice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; 
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
    const modelId = language === "hi" ? "eleven_multilingual_v2" : "eleven_flash_v2_5";

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=3`;

    console.log(`[TTS] Requesting voice stream using voice=${voiceId}, model=${modelId} for language=${language}`);

    try {
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
        signal
      });

      if (!response.ok) {
        await response.text();
        console.warn(`[TTS] ElevenLabs API failed (${response.status}). Trying OpenAI TTS fallback...`);
        return await this.generateOpenAiSpeechStream(text, signal);
      }

      if (!response.body) {
        throw new Error("ElevenLabs response body stream is missing.");
      }

      return Readable.fromWeb(response.body as any);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw err;
      }
      console.warn("[TTS] ElevenLabs error, falling back to OpenAI TTS:", err);
      return await this.generateOpenAiSpeechStream(text, signal);
    }
  }

  private async generateOpenAiSpeechStream(text: string, signal?: AbortSignal): Promise<Readable> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error("Neither ElevenLabs nor OPENAI_API_KEY is available for TTS generation.");
    }

    console.log("[TTS] Requesting voice stream from OpenAI TTS (model=tts-1, voice=nova)...");
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: "nova",
        response_format: "mp3"
      }),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI TTS returned status ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error("OpenAI TTS response body stream is missing.");
    }

    return Readable.fromWeb(response.body as any);
  }
}
export default TextToSpeechService;
