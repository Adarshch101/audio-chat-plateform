import { describe, expect, it } from "vitest";
import { detectLanguageFromText } from "../src/utils/language-utils";

describe("detectLanguageFromText", () => {
  it("detects English text", () => {
    expect(detectLanguageFromText("My name is Adarsh and I have had a headache for three days.")).toBe("en");
    expect(detectLanguageFromText("I am feeling okay, thank you.")).toBe("en");
  });

  it("detects Hindi (Devanagari) text", () => {
    expect(detectLanguageFromText("मेरा नाम आदर्श है।")).toBe("hi");
    expect(detectLanguageFromText("मुझे तीन दिन से सिरदर्द है।")).toBe("hi");
  });

  it("detects Hindi in mixed (Hinglish + Devanagari) input", () => {
    expect(detectLanguageFromText("मुझे headache है और बुखार भी है")).toBe("hi");
  });

  it("treats digits and punctuation as English", () => {
    expect(detectLanguageFromText("7 out of 10")).toBe("en");
    expect(detectLanguageFromText("")).toBe("en");
    expect(detectLanguageFromText("...")).toBe("en");
  });
});
