import { HealthSession, ConversationTurn } from "../types/session.types";
import { LlmService, ConversationDecision } from "./llm.service";
import { isExplicitEndSignal, isFillerValue } from "../utils/text-utils";
import { detectLanguageFromText } from "../utils/language-utils";

type CollectedHealthData = HealthSession["collectedData"];

export class ConversationService {
  private activeSessions = new Map<string, HealthSession>();
  private llmService: LlmService;

  constructor(llmService?: LlmService) {
    this.llmService = llmService ?? new LlmService();
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

  /**
   * Switches the active conversation language (used by auto-detection). The
   * next LLM decision and any deterministic fallback question then respond in
   * the newly detected language.
   */
  public updateLanguage(sessionId: string, language: "en" | "hi") {
    const session = this.getSession(sessionId);
    if (session) {
      session.language = language;
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

    // 4. Merge extracted fields non-destructively:
    //    - Scalars are set ONLY if not already collected. The LLM re-emits all
    //      fields every turn from the full history, and re-normalizing them
    //      causes drift (e.g. name "adarsh" -> "Adarsh", severity "6" ->
    //      "quite severe"). Preserving the first captured value keeps the
    //      state stable and matches the prompt's "never overwrite" rule.
    //    - Array attributes (symptoms, medications, allergies, history, etc.)
    //      are append-only, filler-filtered, and de-duplicated.
    const ARRAY_FIELDS = new Set<string>([
      "relatedSymptoms",
      "medications",
      "allergies",
      "medicalHistory",
      "familyHistory",
      "triggers",
      "vitals"
    ]);

    const currentData = session.collectedData;
    const newData = decision.extractedInformation;

    if (newData) {
      for (const key of Object.keys(newData)) {
        const val = (newData as any)[key];
        if (val === null || val === undefined) continue;

        if (ARRAY_FIELDS.has(key)) {
          const currentItems = (currentData as any)[key] || [];
          const newItems = Array.isArray(val)
            ? (val as string[])
            : typeof val === "string"
              ? [val]
              : [];
          // Drop filler placeholders ("none", "n/a", ...) so they can't block
          // a real value being recorded on a later turn.
          const cleanItems = newItems.filter((item) => !isFillerValue(item));
          const merged = Array.from(new Set([...currentItems, ...cleanItems]));
          if (merged.length > currentItems.length) {
            (currentData as any)[key] = merged;
          }
        } else {
          const existing = (currentData as any)[key];
          if (existing === undefined || existing === null || existing === "") {
            // Do not store filler text like "none mentioned" / "n/a" — it would
            // poison first-captured-wins and block a real value later.
            if (typeof val === "string" && isFillerValue(val)) continue;
            (currentData as any)[key] = val;
          }
        }
      }
    }

    // 4c. Verbatim-repeat guard: a weak model sometimes returns the EXACT same
    // spokenResponse twice in a row (degenerate loop). If so, force a fresh,
    // deterministically-phrased question for the next still-missing attribute
    // so the user never hears a repeated sentence and the dialogue advances.
    const lastAssistantTurn = [...session.conversation].reverse().find((t) => t.role === "assistant");
    if (
      decision.nextAction === "ask_question" &&
      lastAssistantTurn &&
      decision.spokenResponse.trim() === lastAssistantTurn.text.trim()
    ) {
      console.warn("[CALL] Detected verbatim repeat of the previous assistant turn. Forcing a fresh question.");
      decision.spokenResponse = buildNextMissingQuestion(currentData, session.language);
      decision.nextQuestion = decision.spokenResponse;
      decision.needsClarification = false;
    }

    // 4d. Completion gate: the conversation must NEVER wrap up (and trigger
    // report generation) unless the user has explicitly signalled they are
    // done. A small model may return "complete" as soon as attributes are
    // full even when the user's latest message still carries new information
    // (e.g. "i have taken paracetamol"). In that case downgrade to a
    // continuing ask_question so the new facts can still be captured.
    const lastUserMsg =
      [...session.conversation].reverse().find((t) => t.role === "user")?.text ?? userText;
    if (decision.nextAction === "complete" && !isExplicitEndSignal(lastUserMsg)) {
      console.warn(`[CALL] Model requested "complete" but user did not explicitly signal they are done ("${lastUserMsg}"). Continuing intake instead.`);
      decision.nextAction = "ask_question";
      decision.nextQuestion = null;
      decision.needsClarification = false;
      decision.spokenResponse = buildNextMissingQuestion(currentData, session.language);
    }

    // 4e. Language guard: the assistant must ALWAYS talk in the user's language.
    // Auto-detection already switches session.language before this turn runs,
    // but the model may still reply in the old language (e.g. it keeps using
    // English after the user switched to Hindi). If the response language
    // doesn't match, replace it with a localized deterministic message so
    // spoken output always matches the user.
    enforceResponseLanguage(decision, currentData, session.language);

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

/**
 * Deterministically phrases the next question for the first still-missing
 * attribute, in natural collection order. Used only as a guard when the LLM
 * degenerates into repeating its previous question verbatim (or for downgraded
 * completions) so the dialogue keeps advancing.
 */
function buildNextMissingQuestion(data: CollectedHealthData, language: "en" | "hi"): string {
  const questions: { key: string; en: string; hi: string }[] = [
    { key: "name", en: "Could you please tell me your name?", hi: "कृपया अपना नाम बताएं?" },
    { key: "mainConcern", en: "What is the main health concern today?", hi: "आज आपको परेशान करने वाली मुख्य स्वास्थ्य समस्या क्या है?" },
    { key: "duration", en: "How long have you been experiencing this?", hi: "यह समस्या कितने समय से बनी हुई है?" },
    { key: "severity", en: "How severe is it, on a scale of 1 to 10?", hi: "यह कितनी गंभीर है? कृपया 1 से 10 के पैमाने पर बताएं।" },
    { key: "onset", en: "Did the symptoms come on suddenly or gradually?", hi: "क्या ये लक्षण अचानक आए या धीरे-धीरे?" },
    { key: "relatedSymptoms", en: "Have you noticed any other related symptoms?", hi: "क्या इसके साथ कोई अन्य संबंधित लक्षण भी हैं?" },
    { key: "medications", en: "Are you currently taking any medications?", hi: "क्या आप वर्तमान में कोई दवा ले रहे हैं?" },
    { key: "allergies", en: "Do you have any known allergies?", hi: "क्या आपको कोई ज्ञात एलर्जी है?" },
    { key: "medicalHistory", en: "Do you have any ongoing or past medical conditions?", hi: "क्या आपको कोई चल रही या पुरानी बीमारी है?" },
    { key: "familyHistory", en: "Is there any relevant illness that runs in your family?", hi: "क्या परिवार में कोई प्रासंगिक बीमारी चल रही है?" },
    { key: "smokingStatus", en: "Do you smoke or use tobacco products?", hi: "क्या आप धूम्रपान या तंबाकू का उपयोग करते हैं?" },
    { key: "triggers", en: "Have you noticed anything that makes the symptoms better or worse?", hi: "क्या किसी चीज़ से लक्षण बढ़ते या घटते हैं?" },
    { key: "vitals", en: "Have you checked any of your vitals, such as temperature or blood pressure?", hi: "क्या आपने तापमान या रक्तचाप जैसी कोई महत्वपूर्ण जांच की है?" },
    { key: "additionalContext", en: "Is there any other important information you'd like to share?", hi: "क्या कोई और महत्वपूर्ण जानकारी है जो आप साझा करना चाहेंगे?" }
  ];

  for (const q of questions) {
    const value = (data as any)[q.key];
    if (Array.isArray(value)) {
      if (value.length === 0) return q[language];
    } else if (typeof value !== "string" || value.trim() === "") {
      return q[language];
    }
  }

  return language === "hi" ? "क्या आप कुछ और साझा करना चाहेंगे?" : "Is there anything else you'd like to add?";
}

/**
 * Guarantees the assistant's spoken response is in the user's active language.
 * If the model ignored the targetLanguage instruction (detected via the text's
 * script), the response is replaced with a fully localized, deterministic
 * message so speech always matches the user's language.
 */
function enforceResponseLanguage(
  decision: ConversationDecision,
  data: CollectedHealthData,
  language: "en" | "hi"
) {
  const responseLanguage = detectLanguageFromText(decision.spokenResponse);
  if (responseLanguage === language) return;

  console.warn(
    `[LANG] Model responded in ${responseLanguage} but the user speaks ${language}. Forcing a localized response.`
  );

  if (decision.nextAction === "urgent_attention") {
    decision.spokenResponse =
      language === "hi"
        ? "यह गंभीर हो सकता है। कृपया तुरंत आपातकालीन सेवाओं (911) से संपर्क करें या निकटतम आपातकालीन कक्ष में जाएं।"
        : "This could be serious. Please contact emergency services (911) right away or go to the nearest emergency room.";
    decision.nextQuestion = null;
    return;
  }

  if (decision.nextAction === "complete") {
    decision.spokenResponse =
      language === "hi"
        ? "ठीक है, सब जानकारी एकत्र हो गई है। मैं अब आपकी स्वास्थ्य जांच रिपोर्ट तैयार कर रहा हूं।"
        : "Alright, I have everything I need. I'm now preparing your health screening report.";
    decision.nextQuestion = null;
    return;
  }

  // ask_question / clarify: fall back to a localized deterministic next
  // question so the intake keeps progressing in the correct language.
  const localized = buildNextMissingQuestion(data, language);
  decision.spokenResponse = localized;
  decision.nextQuestion = localized;
  decision.needsClarification = false;
}
