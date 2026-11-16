import { afterEach, describe, expect, it, vi } from "vitest";
import {
  abortModelBytes,
  fetchModelBytes,
  type ModelProgress,
  releaseModelBytes,
  subscribeModelProgress,
} from "@/components/projects/modelAssets";

function streamResponse(
  chunks: number[],
  headers: Record<string, string> = {},
): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchModelBytes()", () => {
  it("streams the body and reports completion", async () => {
    const fetchMock = vi.fn(async () =>
      streamResponse([100, 50], { "content-length": "150" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = "/models/a.glb?v=1";
    const bytes = fetchModelBytes(url, 999);
    const seen: ModelProgress[] = [];
    subscribeModelProgress(url, (progress) => seen.push({ ...progress }));
    const buffer = await bytes;

    expect(buffer.byteLength).toBe(150);
    expect(seen.at(-1)).toEqual({ loaded: 150, total: 150, done: true });
    releaseModelBytes(url, bytes);
  });

  it("shares one request between callers until the bytes are released", async () => {
    const fetchMock = vi.fn(async () => streamResponse([10]));
    vi.stubGlobal("fetch", fetchMock);

    const url = "/models/b.glb?v=1";
    const first = fetchModelBytes(url);
    expect(fetchModelBytes(url)).toBe(first);
    await first;
    releaseModelBytes(url, first);
    await fetchModelBytes(url);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the expected size when the response is compressed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamResponse([40], {
          "content-length": "20",
          "content-encoding": "gzip",
        }),
      ),
    );
    const url = "/models/c.glb?v=1";
    const bytes = fetchModelBytes(url, 80);
    const totals: number[] = [];
    subscribeModelProgress(url, (progress) => totals.push(progress.total));
    await bytes;
    expect(totals[0]).toBe(80);
    releaseModelBytes(url, bytes);
  });

  it("rejects on HTTP errors and allows a retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(streamResponse([5]));
    vi.stubGlobal("fetch", fetchMock);

    const url = "/models/missing.glb?v=1";
    await expect(fetchModelBytes(url)).rejects.toThrow(/404/);
    await expect(fetchModelBytes(url)).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it("aborts a download nobody needs anymore", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const url = "/models/slow.glb?v=1";
    const bytes = fetchModelBytes(url);
    abortModelBytes(url);
    await expect(bytes).rejects.toMatchObject({ name: "AbortError" });
  });
});
