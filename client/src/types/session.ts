// Domain models shared by the view layer (pages/components) and the data
// access layer (services). These mirror the server's session/report payloads.

export type TriageLevel = "urgent" | "high" | "routine";

export type ReviewStatus = "pending" | "reviewed";

export interface HealthReport {
  patientName: string | null;
  mainConcern: string | null;
  duration: string | null;
  severity: string | null;
  onset: string | null;
  smokingStatus: string | null;
  keySymptoms: string[];
  medications: string[];
  allergies: string[];
  medicalHistory: string[];
  familyHistory: string[];
  triggers: string[];
  vitals: string[];
  additionalContext: string[];
  followUpFlags: string[];
  missingInformation: string[];
  summary: string;
  disclaimer: string;
}

export interface SessionSummary {
  sessionId: string;
  language: "en" | "hi";
  status: string;
  createdAt: number;
  updatedAt: number;
  patientName: string | null;
  mainConcern: string | null;
  severity: string | null;
  followUpFlagsCount: number;
  triage: TriageLevel;
  reviewStatus: ReviewStatus;
  hasReport: boolean;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface CollectedData {
  name?: string;
  mainConcern?: string;
  duration?: string;
  severity?: string;
  onset?: string;
  relatedSymptoms?: string[];
  medications?: string[];
  allergies?: string[];
  medicalHistory?: string[];
  familyHistory?: string[];
  smokingStatus?: string;
  triggers?: string[];
  vitals?: string[];
  additionalContext?: string;
  [key: string]: unknown;
}

export interface SessionDetail {
  sessionId: string;
  language: "en" | "hi";
  status: string;
  currentStep: string;
  collectedData: CollectedData;
  conversation: ConversationTurn[];
  report: HealthReport | null;
  reviewStatus?: ReviewStatus;
  createdAt: number;
  updatedAt: number;
}

// Chat bubble shown in the transcript (used by the call screen + report view).
export interface ChatTurn {
  sender: "user" | "assistant";
  text: string;
  timestamp: number;
}