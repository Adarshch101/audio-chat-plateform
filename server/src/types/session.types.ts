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
    relatedSymptoms?: string[];
    additionalContext?: string;
  };

  conversation: ConversationTurn[];

  report?: HealthReport;

  createdAt: number;
  updatedAt: number;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}
