import { z } from "zod";

// Helper: coerce a value that may be a string, null, undefined, or array into a string array
const flexibleStringArray = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim() !== "") return [val];
  return [];
}, z.array(z.string()));

export const HealthReportSchema = z.object({
  patientName: z.string().nullable().default(null),
  mainConcern: z.string().nullable().default(null),
  duration: z.string().nullable().default(null),
  severity: z.string().nullable().default(null),
  onset: z.string().nullable().default(null),
  smokingStatus: z.string().nullable().default(null),
  keySymptoms: flexibleStringArray.default([]),
  medications: flexibleStringArray.default([]),
  allergies: flexibleStringArray.default([]),
  medicalHistory: flexibleStringArray.default([]),
  familyHistory: flexibleStringArray.default([]),
  triggers: flexibleStringArray.default([]),
  vitals: flexibleStringArray.default([]),
  additionalContext: flexibleStringArray.default([]),
  followUpFlags: flexibleStringArray.default([]),
  missingInformation: flexibleStringArray.default([]),
  summary: z.string().default("No summary available."),
  disclaimer: z.string().default("This report summarizes information discussed during the health screening conversation and is not a medical diagnosis.")
});

export type HealthReport = z.infer<typeof HealthReportSchema>;
