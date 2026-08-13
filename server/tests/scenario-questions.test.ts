import { describe, expect, it } from "vitest";
import { suggestScenarioQuestions } from "../src/services/scenario-questions";

describe("suggestScenarioQuestions", () => {
  it("returns headache-specific questions for a headache concern", () => {
    const questions = suggestScenarioQuestions("I have a headache since morning");
    expect(questions).toBeTruthy();
    expect(questions!.some((q) => q.toLowerCase().includes("throbbing"))).toBe(true);
    expect(questions!.some((q) => q.toLowerCase().includes("light or noise"))).toBe(true);
  });

  it("returns chest-pain questions for a chest concern", () => {
    const questions = suggestScenarioQuestions("chest pain when walking");
    expect(questions!.some((q) => q.toLowerCase().includes("activity"))).toBe(true);
    expect(questions!.some((q) => q.toLowerCase().includes("spread"))).toBe(true);
  });

  it("matches Hindi (Devanagari) concerns", () => {
    const headache = suggestScenarioQuestions("मुझे सिरदर्द है");
    const fever = suggestScenarioQuestions("बुखार और शरीर में दर्द");
    const cough = suggestScenarioQuestions("खांसी जा रही है");

    expect(headache!.some((q) => q.toLowerCase().includes("throbbing"))).toBe(true);
    expect(fever!.some((q) => q.toLowerCase().includes("chills"))).toBe(true);
    expect(cough!.some((q) => q.toLowerCase().includes("dry"))).toBe(true);
  });

  it("matches skin/rash concerns", () => {
    const questions = suggestScenarioQuestions("skin issue with rashes on hands");
    expect(questions!.some((q) => q.toLowerCase().includes("where on your body"))).toBe(true);
  });

  it("returns null for unmatched or empty concerns", () => {
    expect(suggestScenarioQuestions("nothing particular")).toBeNull();
    expect(suggestScenarioQuestions("")).toBeNull();
    expect(suggestScenarioQuestions(undefined)).toBeNull();
  });
});