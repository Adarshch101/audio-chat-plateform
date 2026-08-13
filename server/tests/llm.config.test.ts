import { afterEach, describe, expect, it } from "vitest";
import { resolveLlmCandidates } from "../src/config/llm";

const ENV_KEYS = [
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GROQ_FALLBACK_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_FALLBACK_MODEL"
];

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("resolveLlmCandidates", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it("returns primary + fallback Groq models when only Groq is configured", () => {
    clearEnv();
    process.env.GROQ_API_KEY = "test-groq-key";

    const candidates = resolveLlmCandidates();

    expect(candidates.map((c) => `${c.provider}:${c.model}`)).toEqual([
      "Groq:llama-3.3-70b-versatile",
      "Groq:llama-3.1-8b-instant"
    ]);
  });

  it("dedupes when the fallback model equals the primary model", () => {
    clearEnv();
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
    process.env.GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile";

    const candidates = resolveLlmCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0].model).toBe("llama-3.3-70b-versatile");
  });

  it("appends OpenAI behind Groq when both keys are set", () => {
    clearEnv();
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-4o-mini";

    const candidates = resolveLlmCandidates();

    expect(candidates.map((c) => `${c.provider}:${c.model}`)).toEqual([
      "Groq:llama-3.3-70b-versatile",
      "Groq:llama-3.1-8b-instant",
      "OpenAI:gpt-4o-mini"
    ]);
  });

  it("returns an empty list when no LLM keys are configured", () => {
    clearEnv();

    expect(resolveLlmCandidates()).toEqual([]);
  });
});