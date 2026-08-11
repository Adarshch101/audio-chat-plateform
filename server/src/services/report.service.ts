import OpenAI from "openai";
import { HealthSession } from "../types/session.types";
import { HealthReport, HealthReportSchema } from "../schemas/report.schema";
import { REPORT_PROMPT } from "../prompts/report.prompt";

/**
 * Resolves the best available LLM client and model for report generation.
 * Priority: Groq (free, fast, OpenAI-compatible) > OpenAI
 */
function resolveLlmClient(): { client: OpenAI; model: string; provider: string } | null {
  // Priority 1: Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1"
      }),
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      provider: "Groq"
    };
  }

  // Priority 2: OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      client: new OpenAI({ apiKey: openaiKey }),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      provider: "OpenAI"
    };
  }

  return null;
}

export class ReportService {
  private client: OpenAI | null = null;
  private model: string = "";
  private provider: string = "";
  private initialized: boolean = false;

  private ensureInit() {
    if (this.initialized) return;
    this.initialized = true;
    const resolved = resolveLlmClient();
    if (resolved) {
      this.client = resolved.client;
      this.model = resolved.model;
      this.provider = resolved.provider;
      console.log(`[REPORT] Using ${this.provider} with model: ${this.model}`);
    }
  }

  /**
   * Generates a validated structured health intake report from the completed call session
   */
  public async generateReport(session: HealthSession, signal?: AbortSignal): Promise<HealthReport> {
    this.ensureInit();

    // Chaos simulation hook
    if (process.env.SIMULATE_REPORT_FAILURE === "true") {
      console.warn("[CHAOS] Simulating Report generation completion API drop.");
      throw new Error("[CHAOS] Simulated Report failure.");
    }

    if (!this.client) {
      throw new Error("No LLM API key is configured (GROQ_API_KEY or OPENAI_API_KEY required).");
    }

    const maxRetries = 1;
    let attempt = 0;

    // Filter conversation logs to keep payload size optimal
    const formattedHistory = session.conversation.map((turn) => ({
      role: turn.role,
      text: turn.text
    }));

    const inputContext = {
      language: session.language,
      collectedData: session.collectedData,
      conversationHistory: formattedHistory
    };

    while (attempt <= maxRetries) {
      try {
        console.log(`[REPORT] Requesting ${this.provider} summary compilation using ${this.model} (Attempt ${attempt + 1})...`);

        const response = await this.client.chat.completions.create({
          model: this.model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: REPORT_PROMPT },
            { role: "user", content: JSON.stringify(inputContext) }
          ],
          temperature: 0.1 // Keep temperature minimal to ensure neutral, non-hallucinated summarization
        }, { signal });

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error(`${this.provider} returned an empty content body for report generation.`);
        }

        // Validate using Zod
        const parsed = JSON.parse(content);
        const report = HealthReportSchema.parse(parsed);

        console.log("[REPORT] Structured report compiled and validated successfully.");
        return report;

      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("[REPORT] Report compilation request was aborted.");
          throw err;
        }
        console.warn(`[REPORT] Attempt ${attempt + 1} failed:`, err);
        attempt++;
        if (attempt > maxRetries) {
          throw err;
        }
      }
    }

    throw new Error("Failed to compile valid structured report.");
  }
}
export default ReportService;
