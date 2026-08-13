/**
 * Detects whether a given text is Hindi or English based on its writing script.
 * Hindi is written in Devanagari, so the presence of Devanagari code points is
 * a reliable signal. Latin-script Hindi ("Hinglish") falls back to English.
 */
export function detectLanguageFromText(text: string): "en" | "hi" {
  const devanagariPattern = /[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]/;
  return devanagariPattern.test(text) ? "hi" : "en";
}