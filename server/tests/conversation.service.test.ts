import { describe, it, expect, beforeEach } from "vitest";
import { ConversationService } from "../src/services/conversation.service";
import { LlmService, ConversationDecision } from "../src/services/llm.service";

type RespondFn = (
  collectedData: Record<string, any>
) => ConversationDecision;

/** Deterministic in-memory stand-in for the real LLM service. */
class StubLlmService extends LlmService {
  constructor(private respond: RespondFn) {
    super();
  }

  async decideConversation(
    collectedData: Record<string, any>,
    _history: { role: "user" | "assistant"; text: string }[],
    _language: "en" | "hi",
    _signal?: AbortSignal
  ): Promise<ConversationDecision> {
    return this.respond(collectedData);
  }
}

/** LLM stub that inspects the requested language (to simulate a model that
 *  replies in the wrong language). */
class LanguageStubLlmService extends LlmService {
  constructor(private respond: (language: "en" | "hi") => ConversationDecision) {
    super();
  }

  async decideConversation(
    _collectedData: Record<string, any>,
    _history: { role: "user" | "assistant"; text: string }[],
    language: "en" | "hi",
    _signal?: AbortSignal
  ): Promise<ConversationDecision> {
    return this.respond(language);
  }
}

function askQuestion(overrides: Partial<ConversationDecision>): ConversationDecision {
  return {
    extractedInformation: {},
    needsClarification: false,
    nextAction: "ask_question",
    nextQuestion: null,
    spokenResponse: "What is the main health concern today?",
    ...overrides
  };
}

describe("ConversationService", () => {
  let service: ConversationService;

  beforeEach(() => {
    service = new ConversationService();
  });

  it("merges freshly extracted scalars into collectedData", async () => {
    const stub = new StubLlmService(() =>
      askQuestion({
        extractedInformation: {
          name: "Adarsh",
          mainConcern: "fever",
          duration: "3 days",
          severity: "7/10",
          relatedSymptoms: ["chills"],
          additionalContext: null
        }
      })
    );
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    await service.processUserTurn("s1", "I'm Adarsh. Fever for 3 days, 7/10, with chills.");

    expect(service.getSession("s1")?.collectedData).toMatchObject({
      name: "Adarsh",
      mainConcern: "fever",
      duration: "3 days",
      severity: "7/10",
      relatedSymptoms: ["chills"]
    });
  });

  it("first-captured value wins for scalar fields (no drift on re-emission)", async () => {
    const decisions: ConversationDecision[] = [
      askQuestion({ extractedInformation: { name: "Adarsh" } }),
      askQuestion({ extractedInformation: { name: "adarsh" } })
    ];
    const stub = new StubLlmService(() => decisions.shift()!);
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    await service.processUserTurn("s1", "my name is Adarsh");
    await service.processUserTurn("s1", "just confirming, adarsh");

    expect(service.getSession("s1")?.collectedData.name).toBe("Adarsh");
  });

  it("appends and de-duplicates relatedSymptoms", async () => {
    const decisions: ConversationDecision[] = [
      askQuestion({ extractedInformation: { relatedSymptoms: ["fever", "chills"] } }),
      askQuestion({ extractedInformation: { relatedSymptoms: ["chills", "body ache"] } })
    ];
    const stub = new StubLlmService(() => decisions.shift()!);
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    await service.processUserTurn("s1", "fever and chills");
    await service.processUserTurn("s1", "also body ache");

    expect(service.getSession("s1")?.collectedData.relatedSymptoms).toEqual([
      "fever",
      "chills",
      "body ache"
    ]);
  });

  it("skips filler values so a later real value can be captured", async () => {
    const decisions: ConversationDecision[] = [
      askQuestion({ extractedInformation: { additionalContext: "none mentioned" } }),
      askQuestion({ extractedInformation: { additionalContext: "taken paracetamol" } })
    ];
    const stub = new StubLlmService(() => decisions.shift()!);
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    await service.processUserTurn("s1", "nothing else");
    await service.processUserTurn("s1", "i have taken paracetamol");

    expect(service.getSession("s1")?.collectedData.additionalContext).toBe("taken paracetamol");
  });

  it("filters filler items out of array attributes (medications)", async () => {
    const decisions: ConversationDecision[] = [
      askQuestion({ extractedInformation: { medications: ["none", "paracetamol"] } }),
      askQuestion({ extractedInformation: { medications: ["none"] } }),
      askQuestion({ extractedInformation: { medications: ["ibuprofen"] } })
    ];
    const stub = new StubLlmService(() => decisions.shift()!);
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    await service.processUserTurn("s1", "i take paracetamol");
    await service.processUserTurn("s1", "no other meds");
    await service.processUserTurn("s1", "also ibuprofen sometimes");

    expect(service.getSession("s1")?.collectedData.medications).toEqual([
      "paracetamol",
      "ibuprofen"
    ]);
  });

  it("downgrades 'complete' when the user has NOT signalled they are done", async () => {
    const stub = new StubLlmService(() =>
      askQuestion({
        extractedInformation: { additionalContext: "taken paracetamol" },
        nextAction: "complete",
        spokenResponse: "Wrapping up your screening now."
      })
    );
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    const decision = await service.processUserTurn("s1", "i have taken paracetamol");

    expect(decision.nextAction).toBe("ask_question");
    expect(decision.spokenResponse).not.toContain("Wrapping up");
    // New fact is preserved despite the downgrade
    expect(service.getSession("s1")?.collectedData.additionalContext).toBe("taken paracetamol");
    // Session stays active so intake can continue
    expect(service.getSession("s1")?.status).toBe("active");
  });

  it("allows 'complete' when the user explicitly ends the call", async () => {
    const stub = new StubLlmService(() =>
      askQuestion({
        extractedInformation: {},
        nextAction: "complete",
        spokenResponse: "Wrapping up your screening now."
      })
    );
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    const decision = await service.processUserTurn("s1", "that's all");

    expect(decision.nextAction).toBe("complete");
    expect(service.getSession("s1")?.status).toBe("ended");
  });

  it("forces a fresh question when the model repeats its previous turn verbatim", async () => {
    const decisions: ConversationDecision[] = [
      askQuestion({
        extractedInformation: { name: "Adarsh" },
        spokenResponse: "What is your name?"
      }),
      askQuestion({
        extractedInformation: { mainConcern: "fever" },
        spokenResponse: "What is your name?"
      })
    ];
    const stub = new StubLlmService(() => decisions.shift()!);
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    await service.processUserTurn("s1", "Adarsh");
    const decision = await service.processUserTurn("s1", "I have a fever");

    expect(decision.spokenResponse).toBe("How long have you been experiencing this?");
  });

  it("does not alter a non-repeated question", async () => {
    const decisions: ConversationDecision[] = [
      askQuestion({ extractedInformation: { name: "Adarsh" }, spokenResponse: "What is your name?" }),
      askQuestion({
        extractedInformation: { mainConcern: "fever" },
        spokenResponse: "How long have you been experiencing this?"
      })
    ];
    const stub = new StubLlmService(() => decisions.shift()!);
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    await service.processUserTurn("s1", "Adarsh");
    const decision = await service.processUserTurn("s1", "fever");

    expect(decision.spokenResponse).toBe("How long have you been experiencing this?");
  });

  it("forces a Hindi response when the session is Hindi but the model replies in English", async () => {
    const stub = new LanguageStubLlmService(() =>
      askQuestion({
        extractedInformation: {},
        nextAction: "ask_question",
        spokenResponse: "What is the main health concern today?"
      })
    );
    service = new ConversationService(stub);
    service.createSession("s1", "hi");

    const decision = await service.processUserTurn("s1", "मुझे सिरदर्द है");

    // The English response is replaced with a fully localized Hindi question.
    expect(detectDevanagari(decision.spokenResponse)).toBe(true);
    expect(decision.spokenResponse).not.toContain("What is the main health concern");
  });

  it("forces an English response when the session is English but the model replies in Hindi", async () => {
    const stub = new LanguageStubLlmService(() =>
      askQuestion({
        extractedInformation: {},
        nextAction: "ask_question",
        spokenResponse: "आज आप कैसा महसूस कर रहे हैं?"
      })
    );
    service = new ConversationService(stub);
    service.createSession("s1", "en");

    const decision = await service.processUserTurn("s1", "not great");

    expect(detectDevanagari(decision.spokenResponse)).toBe(false);
    expect(decision.spokenResponse).not.toContain("आज");
  });

  it("leaves a Hindi response untouched when the session is Hindi", async () => {
    const stub = new LanguageStubLlmService(() =>
      askQuestion({
        extractedInformation: { name: "आदर्श" },
        nextAction: "ask_question",
        spokenResponse: "आज आपको मुख्य समस्या क्या है?"
      })
    );
    service = new ConversationService(stub);
    service.createSession("s1", "hi");

    const decision = await service.processUserTurn("s1", "मेरा नाम आदर्श है");

    expect(decision.spokenResponse).toBe("आज आपको मुख्य समस्या क्या है?");
  });
});

function detectDevanagari(text: string): boolean {
  return /[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]/.test(text);
}