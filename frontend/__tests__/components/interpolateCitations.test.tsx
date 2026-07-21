/**
 * Unit tests for the REAL `interpolateCitations` exported from ChatMessage.tsx.
 *
 * These tests replace the tautological copies that lived in the deleted
 * __tests__/components/ChatMessage.test.tsx, which re-implemented the function
 * locally instead of importing it. Coverage here exercises the same boundary
 * conditions (empty sources, no "[", out-of-range markers, surrounding text)
 * against the actual production code.
 */

import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// ─── Mocks required to import ChatMessage.tsx without a DOM environment ───────
vi.mock("gsap", () => ({
  default: { context: vi.fn(() => ({ revert: vi.fn() })), from: vi.fn() },
}));
vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@streamdown/code", () => ({ code: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/chat/chat-context", () => ({
  useChat: vi.fn(() => ({
    editAndResend: vi.fn(),
    isLoading: false,
    isStreaming: false,
    loadingPhase: "idle",
    regenerateResponse: vi.fn(),
    switchBranch: vi.fn(),
  })),
}));
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/dashboard/explore/ui/file-info", () => ({
  getFileInfo: vi.fn(() => ({ icon: null, color: "", label: "" })),
}));
vi.mock("@/components/dashboard/explore/ui/ProcessTimeline", () => ({
  ProcessTimeline: () => <div data-testid="process-timeline" />,
}));

const { interpolateCitations } = await import(
  "@/components/dashboard/explore/ui/ChatMessage"
);

type SourceDocument = {
  filename: string;
  content: string;
  page_number?: number;
};

describe("interpolateCitations() — REAL import from ChatMessage.tsx", () => {
  const sources: SourceDocument[] = [
    { filename: "doc1.pdf", content: "Content of doc1", page_number: 1 },
    { filename: "doc2.pdf", content: "Content of doc2", page_number: 2 },
  ];

  it("returns the original string when sources array is empty", () => {
    const result = interpolateCitations("See [1] for details", []);
    expect(result).toBe("See [1] for details");
  });

  it("returns the original string when text has no '[' character", () => {
    const result = interpolateCitations("No citations here", sources);
    expect(result).toBe("No citations here");
  });

  it("leaves out-of-range markers as plain text and returns original string", () => {
    const result = interpolateCitations("See [99] for details", sources);
    // [99] is out of range — no match recorded, returns original string
    expect(result).toBe("See [99] for details");
  });

  it("replaces in-range [n] markers with React elements (returns array)", () => {
    const result = interpolateCitations("See [1] and [2]", sources);
    expect(Array.isArray(result)).toBe(true);
  });

  it("preserves surrounding text around citations", () => {
    const result = interpolateCitations(
      "Prefix [1] suffix",
      sources,
    ) as ReactNode[];
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe("Prefix ");
    expect(result[result.length - 1]).toBe(" suffix");
  });
});
