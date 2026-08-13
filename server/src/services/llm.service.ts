import { z } from "zod";
import { SYSTEM_PROMPT } from "../prompts/conversation.prompt";
import { parseJsonResponse } from "../utils/json";
import { completeWithFallback, resolveLlmCandidates } from "../config/llm";
import type { LlmCandidate } from "../config/llm";
import { suggestScenarioQuestions } from "./scenario-questions";

// Per-turn budget so a hung provider (network drop, backend stall) can never
// lock a session in "processing" indefinitely. The in-flight request signals
// the same AbortController, so this must be < any server-level idle timeout.
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 45000;

// Define the structured Zod schema for validation.
// All fields are lenient (nullable/optional/nullish) because the model reports
// attributes it hasn't collected yet as null — a strict required array here
// would reject legitimate turns and fall into the "please repeat" fallback.
const optionalStringArray = z.preprocess(
  (val) => (typeof val === "string" ? [val] : val),
  z.array(z.string()).nullish()
);

const ConversationDecisionSchema = z.object({
  extractedInformation: z.object({
    name: z.string().nullish(),
    mainConcern: z.string().nullish(),
    duration: z.string().nullish(),
    severity: z.string().nullish(),
    onset: z.string().nullish(),
    relatedSymptoms: optionalStringArray,
    medications: optionalStringArray,
    allergies: optionalStringArray,
    medicalHistory: optionalStringArray,
    familyHistory: optionalStringArray,
    smokingStatus: z.string().nullish(),
    triggers: optionalStringArray,
    vitals: optionalStringArray,
    additionalContext: z.string().nullish(),
  }),
  needsClarification: z.boolean(),
  nextAction: z.enum(["ask_question", "clarify", "complete", "urgent_attention"]),
  nextQuestion: z.string().nullish(),
  spokenResponse: z.string(),
});

export type ConversationDecision = z.infer<typeof ConversationDecisionSchema>;

export class LlmService {
  private candidates: LlmCandidate[] = [];
  private initialized: boolean = false;

  private ensureInit() {
    if (this.initialized) return;
    this.initialized = true;
    this.candidates = resolveLlmCandidates();
    if (this.candidates.length > 0) {
      console.log(
        `[LLM] Available models: ${this.candidates.map((c) => `${c.provider}:${c.model}`).join(" -> ")}`
      );
    }
  }

  public isAvailable(): boolean {
    this.ensureInit();
    return this.candidates.length > 0;
  }

  /**
   * Invokes LLM chat completions with structured JSON outputs, abort controls and validation schema
   */
  public async decideConversation(
    collectedData: Record<string, any>,
    history: { role: "user" | "assistant"; text: string }[],
    language: "en" | "hi",
    signal?: AbortSignal
  ): Promise<ConversationDecision> {
    this.ensureInit();

    // Chaos simulation hook
    if (process.env.SIMULATE_LLM_FAILURE === "true") {
      console.warn("[CHAOS] Simulating LLM completion API drop.");
      throw new Error("[CHAOS] Simulated LLM failure.");
    }

    if (this.candidates.length === 0) {
      throw new Error("No LLM API key is configured (GROQ_API_KEY or OPENAI_API_KEY required).");
    }

    // Construct the context block to feed LLM.
    // The LATEST user message is the direct answer to the model's last question.
    // Splitting it out of conversationHistory forces the model to extract facts
    // from it instead of re-asking. Small models otherwise lose track of which
    // turn is the current response.
    const turns = Array.isArray(history) ? history : [];
    const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    const latestUserMessage =
      lastTurn && lastTurn.role === "user" ? lastTurn.text : "";
    const priorTurns = lastTurn ? turns.slice(0, -1) : turns;

    // Scenario-driven follow-ups for the stated main concern (rule-based, so the
    // assistant reliably asks targeted questions instead of generic ones).
    const suggestedFollowUps = suggestScenarioQuestions(String(collectedData.mainConcern ?? ""));

    const promptContext = {
      collectedData,
      collectedSummary: buildCollectedSummary(collectedData),
      latestUserMessage,
      conversationHistory: priorTurns,
      suggestedFollowUps,
      targetLanguage: language === "hi" ? "Hindi (हिन्दी)" : "English"
    };

    // Try every configured model in order (Groq primary -> fallback -> OpenAI).
    // A rate limit or quota exhaustion on one model fails over to the next so a
    // live call keeps flowing instead of hitting a dead-end "please repeat".
    try {
      const content = await completeWithFallback(this.candidates, {
        systemPrompt: SYSTEM_PROMPT,
        userContent: JSON.stringify(promptContext),
        timeoutMs: LLM_TIMEOUT_MS,
        logTag: "LLM",
        temperature: 0.4, // Enough warmth for natural, varied question phrasing while keeping JSON extraction reliable
        signal
      });

      // Parse (fence/prose tolerant) and validate using Zod
      const parsed = parseJsonResponse(content);
      const decision = ConversationDecisionSchema.parse(parsed);
      console.log(`[LLM] Decision: action=${decision.nextAction}, needsClarify=${decision.needsClarification}`);
      return decision;
    } catch (err) {
      console.error("[LLM] Completions failed completely. Returning safe fallback payload.", err);
    }
    const fallbackMessage = language === "hi"
      ? "मुझे अभी उस बात को समझने में परेशानी हो रही है। क्या आप कृपया दोहरा सकते हैं?"
      : "I'm having trouble processing that response right now. Could you please repeat what you said?";

    return {
      extractedInformation: {},
      needsClarification: false,
      nextAction: "ask_question",
      nextQuestion: fallbackMessage,
      spokenResponse: fallbackMessage
    };
  }
}

/**
 * Builds a plain-language inventory of which attributes are already collected
 * and which are still missing. Small models (e.g. llama-3.1-8b) frequently
 * ignore the raw collectedData JSON and re-ask for data already gathered; a
 * crisp textual checklist makes the current intake progress unambiguous.
 */
function buildCollectedSummary(data: Record<string, any>): string {
  const labels: { key: string; label: string }[] = [
    { key: "name", label: "name" },
    { key: "mainConcern", label: "main concern" },
    { key: "duration", label: "duration" },
    { key: "severity", label: "severity" },
    { key: "onset", label: "onset (sudden vs gradual)" },
    { key: "relatedSymptoms", label: "related symptoms" },
    { key: "medications", label: "current medications" },
    { key: "allergies", label: "allergies" },
    { key: "medicalHistory", label: "medical history" },
    { key: "familyHistory", label: "family history" },
    { key: "smokingStatus", label: "smoking status" },
    { key: "triggers", label: "triggers" },
    { key: "vitals", label: "reported vitals" },
    { key: "additionalContext", label: "additional context" }
  ];

  const collected: string[] = [];
  const missing: string[] = [];

  for (const { key, label } of labels) {
    const value = data[key];
    if (Array.isArray(value)) {
      if (value.length > 0) {
        collected.push(`${label}: ${value.join(", ")}`);
      } else {
        missing.push(label);
      }
    } else if (typeof value === "string" && value.trim() !== "") {
      collected.push(`${label}: ${value}`);
    } else {
      missing.push(label);
    }
  }

  return `COLLECTED SO FAR (never re-ask for any of these): ${collected.length ? collected.join("; ") : "nothing yet"}.\nSTILL MISSING (ask the most relevant of these next; do not follow this order mechanically): ${missing.length ? missing.join(", ") : "none — all core attributes are complete"}.`;
}
export default LlmService;
