import OpenAI from "openai";
import { z } from "zod";
import { SYSTEM_PROMPT } from "../prompts/conversation.prompt";

// Define the structured Zod schema for validation
export const ConversationDecisionSchema = z.object({
  extractedInformation: z.object({
    name: z.string().nullable().optional(),
    mainConcern: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    severity: z.string().nullable().optional(),
    relatedSymptoms: z.array(z.string()).optional(),
    additionalContext: z.string().nullable().optional(),
  }),
  needsClarification: z.boolean(),
  nextAction: z.enum(["ask_question", "clarify", "complete", "urgent_attention"]),
  nextQuestion: z.string().nullable().optional(),
  spokenResponse: z.string(),
});

export type ConversationDecision = z.infer<typeof ConversationDecisionSchema>;

/**
 * Resolves the best available LLM client and model.
 * Priority: Groq (free, fast, OpenAI-compatible) > OpenAI
 */
function resolveLlmClient(): { client: OpenAI; model: string; provider: string } | null {
  // Priority 1: Groq (free tier, fast inference, OpenAI-compatible SDK)
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

export class LlmService {
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
      console.log(`[LLM] Using ${this.provider} with model: ${this.model}`);
    }
  }

  public isAvailable(): boolean {
    this.ensureInit();
    return !!this.client;
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

    if (!this.client) {
      throw new Error("No LLM API key is configured (GROQ_API_KEY or OPENAI_API_KEY required).");
    }

    const maxRetries = 1;
    let attempt = 0;

    // Construct the context block to feed LLM
    const promptContext = {
      collectedData,
      conversationHistory: history,
      targetLanguage: language === "hi" ? "Hindi (हिन्दी)" : "English"
    };

    while (attempt <= maxRetries) {
      try {
        console.log(`[LLM] Requesting ${this.provider} completion using model: ${this.model} (Attempt ${attempt + 1})...`);
        
        const response = await this.client.chat.completions.create({
          model: this.model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(promptContext) }
          ],
          temperature: 0.1 // Low temperature to maximize extraction consistency
        }, { signal });

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error(`${this.provider} returned an empty content body.`);
        }

        // Parse and validate using Zod
        const parsed = JSON.parse(content);
        const decision = ConversationDecisionSchema.parse(parsed);
        console.log(`[LLM] Decision: action=${decision.nextAction}, needsClarify=${decision.needsClarification}`);
        return decision;

      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.log("[LLM] Request was aborted.");
          throw err; // Propagate aborts instantly
        }
        console.warn(`[LLM] Attempt ${attempt + 1} failed:`, err);
        attempt++;
        if (attempt > maxRetries) {
          break;
        }
      }
    }

    // Fallback safe decision block if completions or validations completely fail
    console.error("[LLM] Completions failed completely. Returning safe fallback payload.");
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
export default LlmService;
