import { HealthSession } from "../src/types/session.types";

// Shared test fixture for a completed screening session with a full report.
// Used by both the file-store and MongoDB persistence suites so the session
// shape is defined once instead of duplicated per suite.
export function sampleSession(sessionId: string, language: "en" | "hi" = "en"): HealthSession {
  const hindi = language === "hi";
  return {
    sessionId,
    language,
    status: "ended",
    currentStep: "complete",
    collectedData: {
      name: "Adarsh",
      mainConcern: hindi ? "sir dard" : "fever",
      duration: hindi ? "3 din" : "3 days",
      severity: "7/10",
      relatedSymptoms: hindi ? ["chakkar", "kamzori"] : ["chills", "body ache"],
      additionalContext: "taken paracetamol"
    },
    conversation: [
      { role: "assistant", text: hindi ? "Namaste!" : "Hello!", timestamp: 1 },
      { role: "user", text: hindi ? "mujhe sir dard hai" : "fever since 3 days", timestamp: 2 }
    ],
    report: {
      patientName: "Adarsh",
      mainConcern: hindi ? "sir dard" : "fever",
      duration: hindi ? "3 din" : "3 days",
      severity: "7/10",
      onset: "sudden",
      smokingStatus: "never",
      keySymptoms: hindi ? ["chakkar"] : ["chills", "body ache"],
      medications: ["paracetamol"],
      allergies: [],
      medicalHistory: [],
      familyHistory: [],
      triggers: ["cold weather"],
      vitals: ["temperature 102F"],
      additionalContext: ["taken paracetamol"],
      followUpFlags: [],
      missingInformation: ["Medical history", "Allergies"],
      summary: hindi
        ? "User reported headache for 3 days."
        : "User reported fever for 3 days with chills.",
      disclaimer: "Not a diagnosis."
    },
    createdAt: 1000,
    updatedAt: 2000
  };
}