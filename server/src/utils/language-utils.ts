/**
 * Detects whether a given text is predominantly Hindi or English, based on the
 * writing script. Hindi is written in the Devanagari script, so the presence of
 * Devanagari code points is a reliable signal even in mixed ("Hinglish") input.
 *
 * Note: Hinglish text typed purely in the Latin alphabet cannot be detected and
 * falls back to English. This matches the app's two supported languages.
 */
export function detectLanguageFromText(text: string): "en" | "hi" {
  // Devanagari: U+0900–U+097F (base block), U+A8E0–U+A8FF (extended),
  // and U+1CD0–U+1CFF (Vedic extensions) cover all common Hindi text.
  const devanagariPattern = /[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]/;
  return devanagariPattern.test(text) ? "hi" : "en";
}