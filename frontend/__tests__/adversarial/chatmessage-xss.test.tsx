/**
 * ADVERSARIAL (red-team) tests for the URL/XSS filter in the REAL
 * components/dashboard/explore/ui/ChatMessage.tsx.
 *
 * IMPORTANT — why this file exists separately from the existing
 * __tests__/components/ChatMessage.test.tsx:
 *   The existing test RE-IMPLEMENTS the predicate (`const SAFE_HREF_RE = ...`,
 *   a local `isSafeHref`, and a local `SafeLink`). It NEVER imports the real
 *   component. If the production regex regressed (e.g. someone changed it to a
 *   denylist or dropped the `^` anchor), that test would still pass — it is
 *   tautological with respect to the real code.
 *
 *   This suite instead mounts the REAL ChatMessage, captures the `components`
 *   map the real `buildMarkdownComponents` passes to <Streamdown>, and invokes
 *   the real `a` renderer with adversarial hrefs. So a failure here reflects the
 *   real shipping behaviour.
 *
 * Security requirement derived FIRST:
 *   Model-authored answers may contain arbitrary links. The `a` override is the
 *   security boundary: it must render ONLY http(s)/mailto as a clickable anchor
 *   and degrade every dangerous scheme to inert text (<span>), so a poisoned RAG
 *   document or prompt-injected answer cannot emit javascript:/data:/vbscript:
 *   etc. as a live link.
 */
import { render } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Capture the components map the real component hands to Streamdown.
let capturedComponents: Record<string, unknown> | null = null;

vi.mock("gsap", () => ({
  default: { context: vi.fn(() => ({ revert: vi.fn() })), from: vi.fn() },
}));
vi.mock("streamdown", () => ({
  Streamdown: (props: {
    components?: Record<string, unknown>;
    children?: ReactNode;
  }) => {
    if (props.components) capturedComponents = props.components;
    return <div data-testid="streamdown">{props.children}</div>;
  },
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

const { ChatMessage } = await import(
  "@/components/dashboard/explore/ui/ChatMessage"
);

// Render a real assistant message so buildMarkdownComponents runs and the map
// reaches our Streamdown mock.
function captureRealComponents(): Record<string, unknown> {
  capturedComponents = null;
  render(
    <ChatMessage
      message={
        {
          id: "m1",
          role: "assistant",
          content: "see [the link](https://example.com)",
          isStreaming: false,
          sources: [],
        } as never
      }
    />,
  );
  if (!capturedComponents) {
    throw new Error("Failed to capture real Streamdown components map");
  }
  return capturedComponents;
}

// Invoke the REAL `a` renderer and decide whether it produced a live anchor.
function renderRealAnchor(href: string | undefined): "anchor" | "inert" {
  const comps = captureRealComponents();
  const A = comps.a as (props: {
    href?: string;
    children: ReactNode;
  }) => ReactNode;
  const out = A({ href, children: "x" });
  if (isValidElement(out)) {
    // The real code returns <a ...> for safe, <span ...> for unsafe.
    return (out.type as string) === "a" ? "anchor" : "inert";
  }
  return "inert";
}

describe("ADVERSARIAL ChatMessage `a` override — REAL component, dangerous schemes blocked", () => {
  const dangerous = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)", // leading spaces (trim then still js:)
    "java\tscript:alert(1)", // embedded tab
    "java\nscript:alert(1)", // embedded newline
    "javascript :alert(1)", // space before colon
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.com", // protocol-relative
    "%6Aavascript:alert(1)", // percent-encoded 'j'
    "", // empty
    "/relative/path",
    "relative",
  ];

  for (const href of dangerous) {
    it(`renders INERT (span) for dangerous href ${JSON.stringify(href)}`, () => {
      expect(renderRealAnchor(href)).toBe("inert");
    });
  }

  it("renders INERT for undefined href", () => {
    expect(renderRealAnchor(undefined)).toBe("inert");
  });
});

describe("ADVERSARIAL ChatMessage `a` override — REAL component, safe schemes allowed", () => {
  const safe = [
    "https://example.com",
    "http://example.com/path?q=1",
    "HTTPS://EXAMPLE.COM",
    "mailto:user@example.com",
    "MAILTO:user@example.com",
    "  https://example.com  ", // surrounding whitespace trimmed
  ];

  for (const href of safe) {
    it(`renders a live anchor for safe href ${JSON.stringify(href)}`, () => {
      expect(renderRealAnchor(href)).toBe("anchor");
    });
  }

  it("safe anchors carry rel=noopener noreferrer and target=_blank", () => {
    const comps = captureRealComponents();
    const A = comps.a as (props: { href?: string; children: ReactNode }) => {
      props: Record<string, unknown>;
      type: unknown;
    };
    const el = A({ href: "https://example.com", children: "x" });
    expect((el.props as Record<string, unknown>).rel).toBe(
      "noopener noreferrer",
    );
    expect((el.props as Record<string, unknown>).target).toBe("_blank");
  });
});

/**
 * ROBUSTNESS GAP (documented, not a hard XSS): the real allowlist is
 *   /^(https?:|mailto:)/i.test(href.trim())
 * which accepts a scheme with NO authority, e.g. "https:evil" or "https:\t//x".
 * These are NOT script-executing, so they are not an XSS bypass — the allowlist
 * is anchored and rejects every javascript:/data:/vbscript: variant above. We
 * pin the (benign) accepted behaviour so a future tightening is a deliberate,
 * test-visible change rather than silent.
 */
describe("ChatMessage `a` override — authority-less https is accepted (benign robustness note)", () => {
  it("accepts 'https:evil' as an anchor (no authority) — documented, not dangerous", () => {
    // This is NOT a security failure: https: cannot execute script. It is a
    // looseness in the allowlist worth knowing about.
    expect(renderRealAnchor("https:evil")).toBe("anchor");
  });
});
