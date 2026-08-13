/**
 * Parses an LLM JSON response that may be wrapped in markdown code fences or
 * padded with surrounding prose. Providers occasionally return:
 *
 *   ```json
 *   { ... }
 *   ```
 *
 * or a humanized line such as "Here is the result: { ... }". A bare
 * JSON.parse on those would throw and waste a retry, so we normalize first.
 */
export function parseJsonResponse(content: string): unknown {
  let text = content.trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    // Fallback: extract the outermost {...} block if prose wraps it.
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }

  return JSON.parse(text);
}
