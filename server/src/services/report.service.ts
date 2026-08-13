import { HealthSession } from "../types/session.types";
import { HealthReport, HealthReportSchema } from "../schemas/report.schema";
import { REPORT_PROMPT } from "../prompts/report.prompt";
import { parseJsonResponse } from "../utils/json";
import { completeWithFallback, resolveLlmCandidates } from "../config/llm";
import type { LlmCandidate } from "../config/llm";

// Budget for a single report compilation, mirroring the conversation-turn
// timeout so a hung provider surfaces as a retryable failure.
const REPORT_TIMEOUT_MS = Number(process.env.REPORT_TIMEOUT_MS) || 60000;

// Reports only need the most recent dialogue; replaying an entire long
// transcript risks blowing the context/token budget and permanently failing
// report generation. Mirror the conversation history bound.
const REPORT_HISTORY_LIMIT = 20;

export class ReportService {
  private candidates: LlmCandidate[] = [];
  private initialized: boolean = false;

  private ensureInit() {
    if (this.initialized) return;
    this.initialized = true;
    this.candidates = resolveLlmCandidates();
    if (this.candidates.length > 0) {
      console.log(
        `[REPORT] Available models: ${this.candidates.map((c) => `${c.provider}:${c.model}`).join(" -> ")}`
      );
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

    if (this.candidates.length === 0) {
      throw new Error("No LLM API key is configured (GROQ_API_KEY or OPENAI_API_KEY required).");
    }

    // Filter conversation logs to keep payload size optimal. Only the most
    // recent turns are needed for a summary; older turns cost tokens without
    // improving the output.
    const formattedHistory = session.conversation
      .slice(-REPORT_HISTORY_LIMIT)
      .map((turn) => ({
        role: turn.role,
        text: turn.text
      }));

    const inputContext = {
      language: session.language,
      collectedData: session.collectedData,
      conversationHistory: formattedHistory
    };

    // Run against every configured model in order; if the primary is rate
    // limited or quota-exhausted the next model picks up the report.
    const content = await completeWithFallback(this.candidates, {
      systemPrompt: REPORT_PROMPT,
      userContent: JSON.stringify(inputContext),
      timeoutMs: REPORT_TIMEOUT_MS,
      logTag: "REPORT",
      temperature: 0.1, // Keep temperature minimal to ensure neutral, non-hallucinated summarization
      signal
    });

    // Parse (fence/prose tolerant) and validate using Zod
    const parsed = parseJsonResponse(content);
    const report = HealthReportSchema.parse(parsed);

    console.log("[REPORT] Structured report compiled and validated successfully.");
    return report;
  }
}
export default ReportService;
