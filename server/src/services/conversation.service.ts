import { HealthSession, ConversationTurn } from "../types/session.types";
import { LlmService, ConversationDecision } from "./llm.service";

export type CollectedHealthData = HealthSession["collectedData"];

export class ConversationService {
  private activeSessions = new Map<string, HealthSession>();
  private llmService: LlmService;

  constructor() {
    this.llmService = new LlmService();
  }

  public createSession(sessionId: string, language: "en" | "hi"): HealthSession {
    const session: HealthSession = {
      sessionId,
      language,
      status: "active",
      currentStep: "greeting",
      collectedData: {},
      conversation: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.activeSessions.set(sessionId, session);
    return session;
  }

  public getSession(sessionId: string): HealthSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  public deleteSession(sessionId: string): boolean {
    return this.activeSessions.delete(sessionId);
  }

  public getConversationHistory(sessionId: string): ConversationTurn[] {
    const session = this.getSession(sessionId);
    return session ? session.conversation : [];
  }

  public updateCollectedData(sessionId: string, data: Partial<CollectedHealthData>) {
    const session = this.getSession(sessionId);
    if (session) {
      session.collectedData = { ...session.collectedData, ...data };
      session.updatedAt = Date.now();
    }
  }

  public endSession(sessionId: string) {
    const session = this.getSession(sessionId);
    if (session) {
      session.status = "ended";
      session.updatedAt = Date.now();
    }
  }

  /**
   * Processes the user's final transcript segment, updates the in-memory health session,
   * queries the OpenAI LLM, and merges the structured results.
   */
  public async processUserTurn(sessionId: string, userText: string, signal?: AbortSignal): Promise<ConversationDecision> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    // 1. Save user turn
    const userTurn: ConversationTurn = {
      role: "user",
      text: userText,
      timestamp: Date.now()
    };
    session.conversation.push(userTurn);
    session.updatedAt = Date.now();

    // 2. Bound history log size (send recent turns, e.g. last 10, to OpenAI to avoid token bloat)
    // Recent turns is an array of objects matching OpenAI completions format
    const historyLimit = 10;
    const recentTurns = session.conversation
      .slice(-historyLimit)
      .map((turn) => ({
        role: turn.role,
        text: turn.text
      }));

    // 3. Invoke LLM logic
    const decision = await this.llmService.decideConversation(
      session.collectedData,
      recentTurns,
      session.language,
      signal
    );

    // 4. Merge extracted fields non-destructively
    const currentData = session.collectedData;
    const newData = decision.extractedInformation;

    if (newData) {
      for (const key of Object.keys(newData)) {
        const val = (newData as any)[key];
        // Critical: Only update if LLM response is not null or undefined
        if (val !== null && val !== undefined) {
          if (key === "relatedSymptoms") {
            const currentSymptoms = currentData.relatedSymptoms || [];
            const newSymptoms = Array.isArray(val) ? (val as string[]) : [];
            // De-duplicate array merge
            const merged = Array.from(new Set([...currentSymptoms, ...newSymptoms]));
            currentData.relatedSymptoms = merged;
          } else {
            (currentData as any)[key] = val;
          }
        }
      }
    }

    // 5. Update step tracker
    session.currentStep = decision.nextAction;

    // 6. Save assistant turn
    const assistantTurn: ConversationTurn = {
      role: "assistant",
      text: decision.spokenResponse,
      timestamp: Date.now()
    };
    session.conversation.push(assistantTurn);
    session.updatedAt = Date.now();

    // Console logging for verification
    console.log(`\n[CALL] session ${sessionId}`);
    console.log(`[USER] "${userText}"`);
    console.log(`[STATE]`, JSON.stringify(session.collectedData, null, 2));
    console.log(`[LLM] action=${decision.nextAction}`);
    console.log(`[ASSISTANT] "${decision.spokenResponse}"\n`);

    // 7. Cleanup session if intake completes or triggers emergency
    if (decision.nextAction === "complete" || decision.nextAction === "urgent_attention") {
      this.endSession(sessionId);
    }

    return decision;
  }
}
