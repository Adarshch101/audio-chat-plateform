import { HealthReport } from "../schemas/report.schema";

export interface HealthSession {
  sessionId: string;
  language: "en" | "hi";
  status: "idle" | "active" | "generating_report" | "ended";
  currentStep: string;

  collectedData: {
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
  };

  conversation: ConversationTurn[];

  report?: HealthReport;

  /** Reviewed/actionable state for the clinician dashboard. */
  reviewStatus?: "pending" | "reviewed";

  createdAt: number;
  updatedAt: number;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}
