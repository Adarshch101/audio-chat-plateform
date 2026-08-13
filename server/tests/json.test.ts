import { describe, it, expect } from "vitest";
import { parseJsonResponse } from "../src/utils/json";

describe("parseJsonResponse", () => {
  it("parses bare JSON", () => {
    expect(parseJsonResponse('{"a":1,"b":"two"}')).toEqual({ a: 1, b: "two" });
  });

  it("parses JSON wrapped in a ```json fence", () => {
    const content = '```json\n{"name":"Adarsh","severity":"7/10"}\n```';
    expect(parseJsonResponse(content)).toEqual({ name: "Adarsh", severity: "7/10" });
  });

  it("parses JSON wrapped in a bare ``` fence", () => {
    const content = '```\n{"ok":true}\n```';
    expect(parseJsonResponse(content)).toEqual({ ok: true });
  });

  it("parses JSON padded by leading prose", () => {
    const content = 'Here is the result: {"mainConcern":"fever"}';
    expect(parseJsonResponse(content)).toEqual({ mainConcern: "fever" });
  });

  it("handles nested objects and arrays (outermost brace slice)", () => {
    const content = 'sure thing! {"a":{"b":[1,2,{"c":3}]},"d":"x"} hope that helps';
    expect(parseJsonResponse(content)).toEqual({ a: { b: [1, 2, { c: 3 }] }, d: "x" });
  });

  it("throws on invalid input so the retry/fallback path can handle it", () => {
    expect(() => parseJsonResponse("not json at all")).toThrow();
  });
});