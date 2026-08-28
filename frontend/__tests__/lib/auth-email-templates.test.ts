import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const templateDirectory = resolve(
  process.cwd(),
  "..",
  "supabase",
  "templates",
  "auth",
);
const templateFiles = readdirSync(templateDirectory).filter((file) =>
  file.endsWith(".html"),
);

describe("Supabase Auth email templates", () => {
  it("share the portal shell and stay independent of hosted web fonts", () => {
    expect(templateFiles).toHaveLength(6);

    for (const file of templateFiles) {
      const html = readFileSync(resolve(templateDirectory, file), "utf8");
      expect(html).toContain("#050807");
      expect(html).toContain("#0a120c");
      expect(html).toContain("-apple-system");
      expect(html).not.toContain("fonts.googleapis.com");
      expect(html).not.toContain("Urbanist");
      expect(html).not.toContain("{{ .ConfirmationURL }}");
    }
  });
});
