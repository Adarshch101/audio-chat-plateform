import { describe, it, expect } from "vitest";
import { isExplicitEndSignal, isFillerValue } from "../src/utils/text-utils";

describe("isExplicitEndSignal", () => {
  it.each([
    "no",
    "nope",
    "nah",
    "nothing else",
    "no more",
    "that's all",
    "that is it",
    "i'm done",
    "all done",
    "bye",
    "ok",
    "okay",
    "nothing more to add",
    "I'm done",
    "That's all for now",
  ])("detects '%s' as an end signal", (text) => {
    expect(isExplicitEndSignal(text)).toBe(true);
  });

  it.each([
    "i have taken paracetamol",
    "my name is adarsh",
    "the fever started 3 days ago",
    "7/10",
    "fever",
    "i have chills and body aches",
    "it hurts at the back of my head",
    "",
    "   ",
  ])("treats '%s' as a signal to continue", (text) => {
    expect(isExplicitEndSignal(text)).toBe(false);
  });
});

describe("isFillerValue", () => {
  it.each([
    "none",
    "nothing",
    "n/a",
    "na",
    "nil",
    "unknown",
    "none mentioned",
    "not mentioned",
    "no additional context",
    "nothing else",
    "not provided",
    "not sure",
    "-",
    "   ",
    "",
  ])("treats '%s' as filler", (value) => {
    expect(isFillerValue(value)).toBe(true);
  });

  it.each(["fever", "taken paracetamol", "high blood pressure", "3 days"])(
    "treats '%s' as a real value",
    (value) => {
      expect(isFillerValue(value)).toBe(false);
    }
  );

  it("is case-insensitive", () => {
    expect(isFillerValue("None Mentioned")).toBe(true);
  });
});