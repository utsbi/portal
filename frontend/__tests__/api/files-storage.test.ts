/**
 * Vitest suite for app/dashboard/files/storage.ts
 *
 * Covers three behaviours confirmed by reading the source:
 *
 *  1. collectAllObjectPaths paginates: Supabase list() is called with
 *     increasing offsets until a short page (< PAGE=1000) terminates the
 *     loop. Entries from ALL pages must appear in the result — a full
 *     first page must not silently truncate the output.
 *
 *  2. removePaths surfaces blocked/partial deletes: Supabase Storage
 *     returns HTTP 200 with data=[] when RLS prevents a DELETE. The
 *     function detects data.length < batch.length and throws instead of
 *     reporting false success. An explicit error field also propagates.
 *
 *  3. moveFolder rollback: objects are moved one-by-one. On the first
 *     failure every already-moved object is moved back (newest first).
 *     If rollback succeeds the original move error is thrown. If rollback
 *     itself fails a "split between" error is thrown that names both
 *     prefixes so the caller can warn the user.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Supabase storage mock ────────────────────────────────────────────────────
// storage.ts executes `const supabase = createClient()` at module level.
// vi.mock is hoisted above all imports, so the mock is in place before that
// initialisation runs.

const listMock = vi.fn();
const removeMock = vi.fn();
const moveMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    storage: {
      // Each call to .from(BUCKET) returns the same set of mock functions so
      // listMock/removeMock/moveMock accumulate all calls regardless of how
      // many times .from() is invoked.
      from: vi.fn(() => ({
        list: listMock,
        remove: removeMock,
        move: moveMock,
      })),
    },
  })),
}));

// Import AFTER mocks are registered (vi.mock hoisting makes this safe even
// with ESM top-level await).
const { collectAllObjectPaths, removePaths, moveFolder, setStorageRoot } =
  await import("@/app/dashboard/files/storage");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build synthetic file entries (id !== null → treated as files, not folders). */
function makeFiles(
  count: number,
  namePrefix = "file-",
): { id: string; name: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    name: `${namePrefix}${i}.txt`,
  }));
}

// ─── Per-test reset ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the module-level activeRoot to null so withRoot() is a no-op and
  // mock call arguments match plain paths with no project prefix.
  // setStorageRoot is a no-op when root === activeRoot, so we cycle through a
  // non-null value to force the reset in case a previous test set a root.
  setStorageRoot("_reset_");
  setStorageRoot(null);
});

// =============================================================================
// collectAllObjectPaths — pagination
// =============================================================================

describe("collectAllObjectPaths", () => {
  describe("pagination", () => {
    it("issues a second list() call when the first page is exactly PAGE (1000) entries and includes all entries from both pages", async () => {
      // PAGE = 1000 in the source. A full first page triggers another call.
      listMock
        .mockResolvedValueOnce({ data: makeFiles(1000), error: null })
        .mockResolvedValueOnce({ data: makeFiles(3, "extra-"), error: null });

      const paths = await collectAllObjectPaths("folder");

      // Exactly two list() calls: offset 0 then offset 1000.
      expect(listMock).toHaveBeenCalledTimes(2);
      expect(listMock).toHaveBeenNthCalledWith(1, "folder", {
        limit: 1000,
        offset: 0,
      });
      expect(listMock).toHaveBeenNthCalledWith(2, "folder", {
        limit: 1000,
        offset: 1000,
      });

      // All 1003 paths (1000 + 3) are present.
      expect(paths).toHaveLength(1003);
      // Spot-check entries from the second page to prove no silent truncation.
      expect(paths).toContain("folder/extra-0.txt");
      expect(paths).toContain("folder/extra-1.txt");
      expect(paths).toContain("folder/extra-2.txt");
    });

    it("stops after a single list() call when the first page is short (< 1000)", async () => {
      listMock.mockResolvedValueOnce({ data: makeFiles(5), error: null });

      const paths = await collectAllObjectPaths("small");

      expect(listMock).toHaveBeenCalledTimes(1);
      expect(paths).toHaveLength(5);
    });
  });

  describe("recursion", () => {
    it("descends into subfolder entries (id === null) and collects their files", async () => {
      // Parent page: one folder entry + one file entry.
      listMock
        .mockResolvedValueOnce({
          data: [
            { id: null, name: "sub" }, // folder → recurse
            { id: "f1", name: "root.txt" }, // file → collect
          ],
          error: null,
        })
        // Subfolder page (short → stops after one call).
        .mockResolvedValueOnce({
          data: [{ id: "f2", name: "nested.txt" }],
          error: null,
        });

      const paths = await collectAllObjectPaths("parent");

      expect(paths).toHaveLength(2);
      expect(paths).toContain("parent/root.txt");
      expect(paths).toContain("parent/sub/nested.txt");
    });
  });

  describe("error handling", () => {
    it("throws the supabase error message when list() returns an error", async () => {
      listMock.mockResolvedValueOnce({
        data: null,
        error: { message: "storage service unavailable" },
      });

      await expect(collectAllObjectPaths("broken")).rejects.toThrow(
        "storage service unavailable",
      );
    });
  });
});

// =============================================================================
// removePaths — delete blocked / partial result
// =============================================================================

describe("removePaths", () => {
  it("resolves when remove() confirms every requested deletion", async () => {
    removeMock.mockResolvedValueOnce({
      data: [{ name: "file.txt" }],
      error: null,
    });

    await expect(removePaths(["folder/file.txt"])).resolves.toBeUndefined();
  });

  it("throws the supabase error message when remove() returns an explicit error", async () => {
    removeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(removePaths(["folder/file.txt"])).rejects.toThrow(
      "permission denied",
    );
  });

  it("throws 'Delete was blocked' when remove() returns an empty data array (RLS silent block)", async () => {
    // Supabase Storage returns HTTP 200 with data=[] when RLS silently blocks
    // a DELETE. The code detects data.length (0) < batch.length (1).
    removeMock.mockResolvedValueOnce({ data: [], error: null });

    await expect(removePaths(["folder/file.txt"])).rejects.toThrow(
      /delete was blocked/i,
    );
  });

  it("throws 'Delete was blocked' when fewer objects are confirmed than requested (partial RLS block)", async () => {
    // Two paths sent, only one confirmed deleted — the other was silently
    // blocked by RLS.
    removeMock.mockResolvedValueOnce({
      data: [{ name: "file-a.txt" }],
      error: null,
    });

    await expect(
      removePaths(["folder/file-a.txt", "folder/file-b.txt"]),
    ).rejects.toThrow(/delete was blocked/i);
  });
});

// =============================================================================
// moveFolder — rollback on mid-move failure
// =============================================================================

describe("moveFolder", () => {
  /**
   * Seed the list mock with a one-page listing so collectAllObjectPaths
   * returns exactly one path per name in <prefix>/<name> form.
   */
  function seedListing(prefix: string, names: string[]): void {
    listMock.mockResolvedValueOnce({
      data: names.map((name, i) => ({ id: `id-${i}`, name })),
      error: null,
    });
  }

  it("resolves when all objects move successfully", async () => {
    seedListing("src", ["a.txt"]);
    moveMock.mockResolvedValueOnce({ error: null });

    await expect(moveFolder("src", "dst")).resolves.toBeUndefined();

    expect(moveMock).toHaveBeenCalledTimes(1);
    expect(moveMock).toHaveBeenCalledWith("src/a.txt", "dst/a.txt");
  });

  it("rolls back already-moved objects and throws the original move error when rollback succeeds", async () => {
    // Scenario: file1 moves OK → file2 fails → rollback file1 (newest first).
    // Source: moveFolder iterates allPaths in order, reverses `moved` array
    // before rollback, then throws error.message (not a split error) when
    // rollbackOk remains true.
    seedListing("old", ["file1.txt", "file2.txt"]);

    moveMock
      .mockResolvedValueOnce({ error: null }) // (1) file1 old→new  ✓
      .mockResolvedValueOnce({ error: { message: "quota exceeded" } }) // (2) file2 old→new  ✗
      .mockResolvedValueOnce({ error: null }); // (3) file1 rollback ✓

    await expect(moveFolder("old", "new")).rejects.toThrow("quota exceeded");

    // 2 forward moves + 1 compensating rollback.
    expect(moveMock).toHaveBeenCalledTimes(3);
    // The rollback moves file1 back from its new location to the original.
    expect(moveMock).toHaveBeenNthCalledWith(
      3,
      "new/file1.txt", // from (where the successful forward move put it)
      "old/file1.txt", // back to source
    );
  });

  it("throws a 'split between' error naming both prefixes when the compensating rollback also fails", async () => {
    // Scenario: file1 moves OK → file2 fails → rollback of file1 also fails.
    // Source: rollbackOk is set to false, so the code throws:
    //   `Move failed and the folder is now split between "${oldPrefix}" and "${newPrefix}". ${error.message}`
    seedListing("old", ["file1.txt", "file2.txt"]);

    moveMock
      .mockResolvedValueOnce({ error: null }) // (1) file1 old→new  ✓
      .mockResolvedValueOnce({ error: { message: "network error" } }) // (2) file2 old→new  ✗
      .mockResolvedValueOnce({ error: { message: "rollback failed" } }); // (3) file1 rollback ✗

    let err!: Error;
    try {
      await moveFolder("old", "new");
    } catch (e) {
      err = e as Error;
    }

    // Both source and destination prefixes must appear in the error message.
    expect(err).toBeDefined();
    expect(err.message).toMatch(/split between "old" and "new"/);
    // The original forward-move error is also embedded in the message.
    expect(err.message).toContain("network error");
  });
});
