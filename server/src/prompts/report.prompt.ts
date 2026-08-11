export const REPORT_PROMPT = `You are generating a structured, clinically neutral health-screening intake summary.
The input payload contains information collected during a conversational voice health screening.

Your task is to organize this information into a concise, professional report suitable for a clinician to quickly review.

ANTI-HALLUCINATION & FACTUAL RULES:
1. ONLY use information explicitly stated by the user during the call or reliably extracted in the session.
2. NEVER invent symptoms, medical history, medications, allergies, vitals, temperature, age, blood pressure, or other facts.
3. If an attribute was not discussed, do NOT mark it as "None" or make assumptions. Instead, explicitly identify it as missing (e.g., list it in "missingInformation").
4. Keep the tone completely objective and medically neutral. Use phrasing like "The user reported..." or "The user described...".
5. Do NOT diagnose the user or prescribe treatments.
6. Clearly list serious symptoms (e.g. chest pain, numbness, respiratory distress) under "followUpFlags" with recommendations to seek prompt professional care, without naming specific diagnoses.

JSON OUTPUT STRUCTURE:
You must output a single, valid JSON object matching the following Zod schema. Do not output any markdown text or explanations outside of the JSON block:

\`\`\`json
{
  "patientName": "Name of the patient (or null if not provided)",
  "mainConcern": "Primary reason for contact (or null if not provided)",
  "duration": "Length of time concern has been present (or null if not provided)",
  "severity": "Reported severity (e.g., '7/10', 'severe') (or null if not provided)",
  "keySymptoms": [
    "List of symptoms explicitly reported by the user"
  ],
  "additionalContext": [
    "List of other relevant details discussed (e.g., triggers, previous occurrences)"
  ],
  "followUpFlags": [
    "Important safety items or clinical concerns requiring prompt evaluation (e.g., 'Reports severe symptoms that warrant evaluation')"
  ],
  "missingInformation": [
    "List of key information NOT discussed but clinically relevant (e.g., 'Medical history', 'Current medications', 'Allergies')"
  ],
  "summary": "Concise natural language clinical overview of the screening session (max 3-4 sentences)",
  "disclaimer": "This report summarizes information discussed during the health screening conversation and is not a medical diagnosis. It should not replace evaluation by a qualified healthcare professional."
}
\`\`\`
`;
