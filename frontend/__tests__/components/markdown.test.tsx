import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/components/dashboard/messages/markdown";

describe("renderMarkdown", () => {
  it("renders the basic inline markdown used by reasoning steps", () => {
    const { container } = render(
      <div>{renderMarkdown("**Planning** with *notes* and `code`")}</div>,
    );

    expect(container.querySelector("strong")?.textContent).toBe("Planning");
    expect(container.querySelector("em")?.textContent).toBe("notes");
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(container.textContent).toContain("Planning with notes and code");
  });
});
