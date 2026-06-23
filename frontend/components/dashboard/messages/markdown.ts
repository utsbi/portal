/**
 * Light hand-rolled markdown renderer for message bubbles.
 * Returns React elements (no dangerouslySetInnerHTML).
 *
 * Supported syntax:
 *   # / ## / ### headings (at line start, at least one space after #)
 *   **bold**, *italic*, _italic_
 *   `inline code`
 *   triple-backtick code blocks (language label after opening fence is ignored)
 *   [text](url) links
 *   bare https? URLs via linkify-it
 *
 * renderMarkdown(text, { highlight }) — wraps matching substrings in <mark>.
 */

import LinkifyIt from "linkify-it";
import { createElement, Fragment, isValidElement, type ReactNode } from "react";

const linkify = new LinkifyIt();

type Token =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; text: string; url: string };

// Inline token regex — longest/most-specific patterns first.
// Groups: 1=bold 2=italic-star 3=italic-underscore 4=inline-code 5=mdlink-text 6=mdlink-url
// Note: no `s` flag (dotAll) — we process per-line so `.` never needs to cross newlines.
const INLINE_RE =
  /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  INLINE_RE.lastIndex = 0;

  let match: RegExpExecArray | null = INLINE_RE.exec(line);
  while (match !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        content: line.slice(lastIndex, match.index),
      });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "bold", content: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "italic", content: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: "italic", content: match[3] });
    } else if (match[4] !== undefined) {
      tokens.push({ type: "code", content: match[4] });
    } else if (match[5] !== undefined && match[6] !== undefined) {
      tokens.push({ type: "link", text: match[5], url: match[6] });
    }

    lastIndex = INLINE_RE.lastIndex;
    match = INLINE_RE.exec(line);
  }

  if (lastIndex < line.length) {
    tokens.push({ type: "text", content: line.slice(lastIndex) });
  }

  return tokens;
}

function expandTextWithLinks(token: Token, keyPrefix: string): ReactNode[] {
  if (token.type !== "text") return [renderToken(token, keyPrefix)];

  const matches = linkify.match(token.content);
  if (!matches || matches.length === 0) {
    return [renderToken(token, keyPrefix)];
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.index > cursor) {
      nodes.push(
        createElement(
          "span",
          { key: `${keyPrefix}-pre${i}` },
          token.content.slice(cursor, m.index),
        ),
      );
    }
    nodes.push(
      createElement(
        "a",
        {
          key: `${keyPrefix}-url${i}`,
          href: m.url,
          target: "_blank",
          rel: "noopener noreferrer",
          className: "text-sbi-green hover:underline",
        },
        m.text,
      ),
    );
    cursor = m.lastIndex;
  }
  if (cursor < token.content.length) {
    nodes.push(
      createElement(
        "span",
        { key: `${keyPrefix}-suf` },
        token.content.slice(cursor),
      ),
    );
  }
  return nodes;
}

function renderToken(token: Token, key: string): ReactNode {
  switch (token.type) {
    case "text":
      // Return a plain string so injectHighlight can detect it via typeof check.
      return token.content;
    case "bold":
      return createElement("strong", { key }, token.content);
    case "italic":
      return createElement("em", { key }, token.content);
    case "code":
      return createElement(
        "code",
        {
          key,
          className: "px-1 py-0.5 rounded bg-sbi-dark/60 font-mono text-[12px]",
        },
        token.content,
      );
    case "link":
      return createElement(
        "a",
        {
          key,
          href: token.url,
          target: "_blank",
          rel: "noopener noreferrer",
          className: "text-sbi-green hover:underline",
        },
        token.text,
      );
  }
}

function renderInline(line: string, lineKey: string): ReactNode[] {
  const tokens = tokenizeLine(line);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    nodes.push(...expandTextWithLinks(tokens[i], `${lineKey}-t${i}`));
  }
  return nodes;
}

/** Highlight substrings within a text node, returning an array of spans and <mark> elements. */
function highlightText(
  text: string,
  highlight: string,
  keyPrefix: string,
  active: boolean,
): ReactNode[] {
  if (!highlight) return [text];
  const lower = text.toLowerCase();
  const hl = highlight.toLowerCase();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let idx = lower.indexOf(hl, cursor);
  let matchCount = 0;
  while (idx !== -1) {
    if (idx > cursor) {
      nodes.push(
        createElement(
          Fragment,
          { key: `${keyPrefix}-pre${matchCount}` },
          text.slice(cursor, idx),
        ),
      );
    }
    nodes.push(
      createElement(
        "mark",
        {
          key: `${keyPrefix}-hl${matchCount}`,
          className: active
            ? "bg-sbi-green/40 text-white rounded px-0.5"
            : "bg-sbi-green/15 text-white rounded px-0.5",
        },
        text.slice(idx, idx + highlight.length),
      ),
    );
    cursor = idx + highlight.length;
    matchCount++;
    idx = lower.indexOf(hl, cursor);
  }
  if (cursor < text.length) {
    nodes.push(
      createElement(
        Fragment,
        { key: `${keyPrefix}-suf${matchCount}` },
        text.slice(cursor),
      ),
    );
  }
  return nodes;
}

/** Walk rendered nodes and inject highlight marks into text-level nodes. */
function injectHighlight(
  nodes: ReactNode[],
  highlight: string,
  active: boolean,
  keyPrefix: string,
): ReactNode[] {
  if (!highlight) return nodes;
  return nodes.map((node, i) => {
    // Bare string (text token with no URLs).
    if (typeof node === "string") {
      const parts = highlightText(
        node,
        highlight,
        `${keyPrefix}-n${i}`,
        active,
      );
      return createElement(Fragment, { key: `${keyPrefix}-n${i}` }, ...parts);
    }
    // React element wrapping a plain-text child (e.g. <span> from expandTextWithLinks).
    if (isValidElement(node)) {
      // `key` is a top-level property on the element (NOT inside props).
      // Reading it via `el.props.key` triggers React's "key is not a prop" warning.
      const el = node as {
        key: string | null;
        type: unknown;
        props: {
          children?: ReactNode;
          className?: string;
          [k: string]: unknown;
        };
      };
      const child = el.props.children;
      if (typeof child === "string") {
        const parts = highlightText(
          child,
          highlight,
          `${keyPrefix}-el${i}`,
          active,
        );
        return createElement(
          el.type as string,
          { ...el.props, key: el.key ?? `${keyPrefix}-el${i}` },
          ...parts,
        );
      }
    }
    return node;
  });
}

export interface RenderMarkdownOpts {
  /** When set, wraps matching substrings in <mark>. */
  highlight?: string;
  /** When true, active styling (brighter) is used for highlight marks. */
  highlightActive?: boolean;
}

export function renderMarkdown(
  text: string,
  opts?: RenderMarkdownOpts,
): ReactNode {
  if (!text) return null;

  const highlight = opts?.highlight?.trim() ?? "";
  const highlightActive = opts?.highlightActive ?? false;

  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let blockKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block detection — allow optional language label after opening fence.
    if (/^`{3}/.test(line.trimStart())) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        nodes.push(
          createElement(
            "pre",
            {
              key: `cb-${blockKey++}`,
              className:
                "block w-full overflow-x-auto rounded-md bg-sbi-dark/70 border border-sbi-dark-border/40 p-3 my-1 text-[12px] font-mono leading-tight",
            },
            createElement("code", null, codeLines.join("\n")),
          ),
        );
        inCodeBlock = false;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Heading detection — must start at beginning of line.
    const h3Match = /^### (.+)$/.exec(line);
    const h2Match = /^## (.+)$/.exec(line);
    const h1Match = /^# (.+)$/.exec(line);

    if (h1Match) {
      const content = renderInline(h1Match[1], `h1-${i}`);
      nodes.push(
        createElement(
          "h1",
          { key: `h1-${i}`, className: "text-lg font-semibold mt-1 mb-0.5" },
          highlight
            ? injectHighlight(content, highlight, highlightActive, `h1inj-${i}`)
            : content,
        ),
      );
      if (i < lines.length - 1)
        nodes.push(createElement("br", { key: `br-${i}` }));
      continue;
    }

    if (h2Match) {
      const content = renderInline(h2Match[1], `h2-${i}`);
      nodes.push(
        createElement(
          "h2",
          { key: `h2-${i}`, className: "text-base font-semibold mt-1 mb-0.5" },
          highlight
            ? injectHighlight(content, highlight, highlightActive, `h2inj-${i}`)
            : content,
        ),
      );
      if (i < lines.length - 1)
        nodes.push(createElement("br", { key: `br-${i}` }));
      continue;
    }

    if (h3Match) {
      const content = renderInline(h3Match[1], `h3-${i}`);
      nodes.push(
        createElement(
          "h3",
          { key: `h3-${i}`, className: "text-sm font-semibold mt-1 mb-0.5" },
          highlight
            ? injectHighlight(content, highlight, highlightActive, `h3inj-${i}`)
            : content,
        ),
      );
      if (i < lines.length - 1)
        nodes.push(createElement("br", { key: `br-${i}` }));
      continue;
    }

    const inlineNodes = renderInline(line, `ln-${i}`);
    const finalNodes = highlight
      ? injectHighlight(inlineNodes, highlight, highlightActive, `inj-${i}`)
      : inlineNodes;
    nodes.push(...finalNodes);
    if (i < lines.length - 1) {
      nodes.push(createElement("br", { key: `br-${i}` }));
    }
  }

  // EOF inside unclosed code block — close it.
  if (inCodeBlock && codeLines.length > 0) {
    nodes.push(
      createElement(
        "pre",
        {
          key: `cb-${blockKey}`,
          className:
            "block w-full overflow-x-auto rounded-md bg-sbi-dark/70 border border-sbi-dark-border/40 p-3 my-1 text-[12px] font-mono leading-tight",
        },
        createElement("code", null, codeLines.join("\n")),
      ),
    );
  }

  return createElement(Fragment, null, ...nodes);
}
