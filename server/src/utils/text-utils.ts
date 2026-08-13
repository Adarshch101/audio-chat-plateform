/**
 * Detects an explicit "I'm done" signal from the user. Used by the completion
 * gate so the conversation never auto-completes (and never triggers report
 * generation) while the user is still sharing information.
 */
export function isExplicitEndSignal(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;

  const compactEnd = /^(no|nope|nah|done|yes|yeah|yep|ok|okay|sure|that's it|that's all|that is it|that is all|nothing else|no more|nothing more|bye|goodbye|im done|i'm done|all done)$/;
  if (compactEnd.test(t)) return true;

  const phraseEnd =
    /(nothing else|no more|nothing more( to (say|add|share))?|that's all|that is all|that's it|that is it|i'?m done|all done|wrap (it )?up|end (the|this) (call|screening)|no other|not needed|don'?t need anything)/i;
  return phraseEnd.test(t);
}

/**
 * Returns true for filler/placeholder text that carries no real information
 * (e.g. "none mentioned", "n/a", "no additional context"). These should not be
 * persisted as collected data.
 */
export function isFillerValue(value: string): boolean {
  const t = value.trim().toLowerCase();
  if (!t) return true;
  const fillers =
    /^(none|nothing|nil|na|n\/a|n\.a\.|null|unknown|no additional context|none mentioned|not mentioned|no other information|nothing else|nothing more|no info|not provided|not sure|-|—)$/;
  return fillers.test(t);
}