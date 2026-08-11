import { z } from "zod";

export const HealthReportSchema = z.object({
  patientName: z.string().nullable(),
  mainConcern: z.string().nullable(),
  duration: z.string().nullable(),
  severity: z.string().nullable(),
  keySymptoms: z.array(z.string()),
  additionalContext: z.array(z.string()),
  followUpFlags: z.array(z.string()),
  missingInformation: z.array(z.string()),
  summary: z.string(),
  disclaimer: z.string()
});

export type HealthReport = z.infer<typeof HealthReportSchema>;
