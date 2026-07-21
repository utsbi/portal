import "server-only";

import { after } from "next/server";

/**
 * Keep best-effort notifications inside the request lifecycle without delaying
 * the HTTP response. The callback is registered lazily so work does not begin
 * before Next/Vercel has attached it to waitUntil().
 */
export function scheduleEmailTask(
  label: string,
  task: () => Promise<unknown>,
): void {
  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`${label} failed:`, error);
    }
  });
}
