import { HealthSession } from "../types/session.types";

type TriageLevel = "urgent" | "high" | "routine";

/**
 * Deterministic, rules-based urgency classification for the clinician
 * dashboard. Priority: explicit urgent_attention > report follow-up flags >
 * numeric severity (>=8 urgent, >=6 high) > keyword severity. Anything
 * unclassifiable falls back to routine (reviewed by the clinician).
 */
export function computeTriage(session: HealthSession): TriageLevel {
  if (session.currentStep === "urgent_attention") return "urgent";

  const flags = session.report?.followUpFlags ?? [];
  if (flags.length > 0) return "urgent";

  const severity = (session.collectedData?.severity ?? "").trim().toLowerCase();
  if (!severity) return "routine";

  const numericMatch = severity.match(/(\d+)\s*\/\s*10/);
  if (numericMatch) {
    const score = Number(numericMatch[1]);
    if (score >= 8) return "urgent";
    if (score >= 6) return "high";
    return "routine";
  }

  if (/severe|very (severe|high|bad|strong)|extreme|worst/i.test(severity)) return "urgent";
  if (/moderate|significant|quite (bad|high|strong)/i.test(severity)) return "high";

  return "routine";
}