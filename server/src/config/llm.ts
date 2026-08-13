import OpenAI from "openai";

/**
 * Ordered list of LLM backends for a single completion. The first candidate is
 * the primary model; later candidates act as automatic failovers. If the
 * primary hits a rate limit, quota exhaustion, timeout, or validation failure,
 * the next model in line is tried so a live call can keep going instead of
 * falling into a dead-end "please repeat" loop.
 *
 * Order (priority): Groq primary -> Groq fallback -> OpenAI primary -> OpenAI fallback.
 * Groq per-model daily token quotas (e.g. the free-tier TPD cap) mean switching
 * to a different model is a genuine recovery path, not just a retry.
 */
export interface LlmCandidate {
  client: OpenAI;
  model: string;
  provider: string;
}

function dedupeCandidates(candidates: LlmCandidate[]): LlmCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.provider}:${c.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Resolves the ordered candidate list from environment variables.
 * Both Groq (primary, free tier) and OpenAI (fallback) are optional; each
 * contributes a primary model plus an optional dedicated fallback model.
 */
export function resolveLlmCandidates(): LlmCandidate[] {
  const candidates: LlmCandidate[] = [];

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groqClient = new OpenAI({
      apiKey: groqKey,
      baseURL: "https://api.groq.com/openai/v1"
    });
    candidates.push({
      client: groqClient,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      provider: "Groq"
    });
    const groqFallback = process.env.GROQ_FALLBACK_MODEL || "llama-3.1-8b-instant";
    if (groqFallback) {
      candidates.push({ client: groqClient, model: groqFallback, provider: "Groq" });
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openaiClient = new OpenAI({ apiKey: openaiKey });
    candidates.push({
      client: openaiClient,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      provider: "OpenAI"
    });
    const openaiFallback = process.env.OPENAI_FALLBACK_MODEL;
    if (openaiFallback) {
      candidates.push({ client: openaiClient, model: openaiFallback, provider: "OpenAI" });
    }
  }

  return dedupeCandidates(candidates);
}

export interface CompletionOptions {
  systemPrompt: string;
  userContent: string;
  timeoutMs: number;
  logTag: string;
  temperature?: number;
  signal?: AbortSignal;
}

/**
 * Runs a single chat completion against every candidate in order, retrying
 * each candidate a bounded number of times. Returns the raw response content
 * on first success. Throws when every candidate is exhausted, or immediately
 * when the caller's abort signal fires (disconnect/end_call must propagate).
 */
export async function completeWithFallback(
  candidates: LlmCandidate[],
  options: CompletionOptions
): Promise<string> {
  const { systemPrompt, userContent, timeoutMs, logTag, signal } = options;
  const temperature = options.temperature ?? 0.1;

  if (candidates.length === 0) {
    throw new Error("No LLM API key is configured (GROQ_API_KEY or OPENAI_API_KEY required).");
  }

  const maxRetries = 1;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      // Combine the caller's abort signal with a hard timeout. External aborts
      // (disconnect / end_call) must propagate instantly; timeouts are treated
      // as ordinary failures so the retry/fallback path still applies.
      const attemptController = new AbortController();
      let timedOut = false;
      const onExternalAbort = () => attemptController.abort();
      const timeoutId = setTimeout(() => {
        timedOut = true;
        attemptController.abort();
      }, timeoutMs);

      if (signal) {
        if (signal.aborted) attemptController.abort();
        else signal.addEventListener("abort", onExternalAbort, { once: true });
      }

      try {
        console.log(
          `[${logTag}] Requesting ${candidate.provider} completion using model: ${candidate.model} (Attempt ${attempt + 1})...`
        );

        const response = await candidate.client.chat.completions.create(
          {
            model: candidate.model,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent }
            ],
            temperature
          },
          { signal: attemptController.signal }
        );

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error(`${candidate.provider} returned an empty content body.`);
        }
        return content;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          if (timedOut) {
            console.warn(`[${logTag}] Request timed out after ${timeoutMs}ms.`);
          } else {
            console.log(`[${logTag}] Request was aborted.`);
            throw err; // External abort: propagate instantly
          }
        } else {
          console.warn(
            `[${logTag}] Attempt ${attempt + 1} failed (${candidate.provider}/${candidate.model}):`,
            err
          );
          lastError = err;
        }
        attempt++;
        if (attempt > maxRetries) break;
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onExternalAbort);
      }
    }
    console.warn(
      `[${logTag}] ${candidate.provider}/${candidate.model} exhausted; moving to next available model.`
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`[${logTag}] All LLM models exhausted.`);
}