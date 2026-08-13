import { describe, it, expect } from "vitest";
import { computeTriage } from "../src/utils/triage";
import { HealthSession } from "../src/types/session.types";

function makeSession(overrides: Partial<HealthSession> = {}): HealthSession {
  return {
    sessionId: "s1",
    language: "en",
    status: "ended",
    currentStep: "complete",
    collectedData: {},
    conversation: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

describe("computeTriage", () => {
  it("flags sessions ended with urgent_attention as urgent", () => {
    expect(computeTriage(makeSession({ currentStep: "urgent_attention" }))).toBe("urgent");
  });

  it("flags sessions with follow-up flags as urgent", () => {
    const session = makeSession({
      report: {
        patientName: null,
        mainConcern: null,
        duration: null,
        severity: null,
        onset: null,
        smokingStatus: null,
        keySymptoms: [],
        medications: [],
        allergies: [],
        medicalHistory: [],
        familyHistory: [],
        triggers: [],
        vitals: [],
        additionalContext: [],
        followUpFlags: ["Reports chest pain that warrants evaluation"],
        missingInformation: [],
        summary: "",
        disclaimer: ""
      }
    });
    expect(computeTriage(session)).toBe("urgent");
  });

  it("maps numeric severity: >=8 urgent, >=6 high, else routine", () => {
    const withSeverity = (severity: string) => makeSession({
      collectedData: { severity }
    });
    expect(computeTriage(withSeverity("9/10"))).toBe("urgent");
    expect(computeTriage(withSeverity("8/10"))).toBe("urgent");
    expect(computeTriage(withSeverity("7/10"))).toBe("high");
    expect(computeTriage(withSeverity("6/10"))).toBe("high");
    expect(computeTriage(withSeverity("5/10"))).toBe("routine");
    expect(computeTriage(withSeverity("3/10"))).toBe("routine");
  });

  it("maps keyword severity", () => {
    const withSeverity = (severity: string) => makeSession({
      collectedData: { severity }
    });
    expect(computeTriage(withSeverity("severe"))).toBe("urgent");
    expect(computeTriage(withSeverity("Very severe pain"))).toBe("urgent");
    expect(computeTriage(withSeverity("moderate"))).toBe("high");
    expect(computeTriage(withSeverity("mild"))).toBe("routine");
  });

  it("defaults to routine when no severity was captured", () => {
    expect(computeTriage(makeSession())).toBe("routine");
  });

  it("flags a session with urgent step even when severity is low", () => {
    const session = makeSession({
      currentStep: "urgent_attention",
      collectedData: { severity: "2/10" }
    });
    expect(computeTriage(session)).toBe("urgent");
  });
});