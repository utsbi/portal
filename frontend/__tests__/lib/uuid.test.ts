import { afterEach, describe, expect, it, vi } from "vitest";
import { uuid } from "@/lib/uuid";

describe("uuid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers crypto.randomUUID when available", () => {
    const randomUUID = vi.fn(() => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    vi.stubGlobal("crypto", { randomUUID });

    expect(uuid()).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("builds an RFC 4122 v4 UUID from getRandomValues", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, index) => {
          bytes[index] = index;
        });
        return bytes;
      },
    });

    expect(uuid()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("fails instead of using an insecure random fallback", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => uuid()).toThrow(
      "A cryptographically secure random source is unavailable",
    );
  });
});
