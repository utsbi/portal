import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterCallback: null as null | (() => Promise<void>),
}));

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void>) => {
    mocks.afterCallback = callback;
  }),
}));

const { scheduleEmailTask } = await import("@/lib/email/schedule");

describe("scheduleEmailTask", () => {
  beforeEach(() => {
    mocks.afterCallback = null;
    vi.restoreAllMocks();
  });

  it("starts email work only inside the registered after callback", async () => {
    const task = vi.fn(async () => undefined);
    scheduleEmailTask("test notification", task);

    expect(task).not.toHaveBeenCalled();
    expect(mocks.afterCallback).not.toBeNull();
    await mocks.afterCallback?.();
    expect(task).toHaveBeenCalledOnce();
  });

  it("contains delivery failures so they do not become unhandled rejections", async () => {
    const error = new Error("provider unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    scheduleEmailTask("test notification", async () => {
      throw error;
    });

    await expect(mocks.afterCallback?.()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "test notification failed:",
      error,
    );
  });
});
