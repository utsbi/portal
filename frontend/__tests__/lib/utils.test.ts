import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("returns empty string with no args", () => {
    expect(cn()).toBe("");
  });

  it("joins simple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes — truthy included, falsy excluded", () => {
    expect(cn("base", true && "included", false && "excluded")).toBe("base included");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    // tailwind-merge resolves p-2 vs p-4 — last one wins
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles undefined and null without throwing", () => {
    expect(cn(undefined, null, "valid")).toBe("valid");
  });

  it("handles arrays of classes", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("handles objects with boolean values", () => {
    expect(cn({ active: true, hidden: false })).toBe("active");
  });

  it("merges multiple conflicting utilities correctly", () => {
    expect(cn("text-sm text-lg", "text-xl")).toBe("text-xl");
  });

  it("preserves non-conflicting classes", () => {
    const result = cn("flex items-center", "gap-4");
    expect(result).toBe("flex items-center gap-4");
  });
});
