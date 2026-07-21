"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { createElement, useCallback, useState } from "react";
import { toast } from "sonner";
import { Toast } from "@/components/dashboard/common/Toast";
import { toastError, toastMoveUndo } from "@/lib/notifications";
import {
  humanizeStorageError,
  invalidatePath,
  invalidatePrefix,
  listFolder,
  moveFolder,
  moveObject,
  parentOf,
} from "./storage";

export interface ActiveDragItem {
  id: string;
  name: string;
  kind: "file" | "folder";
}

interface UseDragMoveArgs {
  isDirector: boolean;
  // Optimistically drop the item out of the current grid, returning a
  // rollback callback that restores it if the move fails.
  removeFromGrid: (srcPath: string, kind: "file" | "folder") => () => void;
  // Force-relist both sides of the move (grid + tree) so the UI converges.
  refreshAfterMove: (
    srcParent: string,
    destFolderPath: string,
  ) => Promise<void>;
  // Best-effort post-move hook (e.g. retarget RAG-index paths). Called after
  // a successful forward move AND after a successful undo (with the paths
  // reversed). Must not throw.
  onMoved?: (
    srcPath: string,
    destPath: string,
    kind: "file" | "folder",
  ) => Promise<void>;
}

function showMovingToast(name: string): string | number {
  return toast.custom(
    () =>
      createElement(Toast, {
        kind: "info",
        title: "Moving",
        message: name,
      }),
    { duration: 60000 },
  );
}

export function useDragMove({
  isDirector,
  removeFromGrid,
  refreshAfterMove,
  onMoved,
}: UseDragMoveArgs) {
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(
    null,
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as
      | { kind: "file" | "folder"; name: string; path: string }
      | undefined;
    if (!data) return;
    setActiveDragItem({
      id: data.path,
      name: data.name,
      kind: data.kind,
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragItem(null);

      // @dnd-kit restores focus to the dragged card after a pointer
      // drag. That re-triggers the card's group-focus-within (blurred
      // name + revealed action icons), leaving it "stuck" until the
      // user clicks away. Drop that focus on the next frame (after
      // @dnd-kit's own focus restore) so the card returns to rest.
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          const el = document.activeElement;
          if (el instanceof HTMLElement) el.blur();
        });
      }

      const { active, over } = event;

      // 1. Only directors can move.
      if (!isDirector) return;
      // 2. Dropped outside any droppable.
      if (!over) return;

      const activeData = active.data.current as
        | { kind: "file" | "folder"; name: string; path: string }
        | undefined;
      const overData = over.data.current as { path?: string } | undefined;
      if (!activeData || overData?.path === undefined) return;

      const srcPath = activeData.path;
      const srcKind = activeData.kind;
      const destFolderPath = overData.path; // root = ""

      // 4. Self drop.
      if (srcPath === destFolderPath) return;

      // 5. Folder into its own descendant.
      if (srcKind === "folder" && destFolderPath.startsWith(`${srcPath}/`)) {
        toastError("Can't move a folder into one of its own subfolders.");
        return;
      }

      // 6. No-op: already lives in the destination.
      const srcParent = parentOf(srcPath);
      if (srcParent === destFolderPath) return;

      const srcName = srcPath.split("/").pop() as string;
      const newPath = destFolderPath ? `${destFolderPath}/${srcName}` : srcName;

      // 8. Name collision in the destination (cache-first; if listing
      //    fails we proceed and let storage reject on conflict).
      try {
        const { data, error: listErr } = await listFolder(destFolderPath);
        if (!listErr && data.some((entry) => entry.name === srcName)) {
          toastError(
            "An item with that name already exists here.",
            "Can't move",
          );
          return;
        }
      } catch {
        // Listing error — proceed; the move will fail loudly if it
        // genuinely collides.
      }

      // 9. Optimistically remove from the grid; show a "Moving" toast.
      const rollback = removeFromGrid(srcPath, srcKind);
      const movingId = showMovingToast(srcName);

      const destLabel = destFolderPath || "Home";

      try {
        if (srcKind === "folder") {
          await moveFolder(srcPath, newPath);
        } else {
          await moveObject(srcPath, newPath);
        }

        toast.dismiss(movingId);

        invalidatePrefix(srcPath);
        invalidatePrefix(newPath);
        invalidatePath(srcParent);
        invalidatePath(destFolderPath);

        await refreshAfterMove(srcParent, destFolderPath);
        await onMoved?.(srcPath, newPath, srcKind);

        toastMoveUndo(srcName, destLabel, async () => {
          try {
            // Mirror the forward collision guard: the
            // reverse destination may have been reoccupied
            // since the move (cache-first, advisory).
            let reverseCollision = false;
            try {
              const { data, error: listErr } = await listFolder(srcParent);
              reverseCollision =
                !listErr && data.some((e) => e.name === srcName);
            } catch {
              // Listing failed: proceed; storage rejects
              // a genuine conflict on its own.
            }
            if (reverseCollision) {
              throw new Error(
                `Can't move "${srcName}" back; it's still in "${destLabel}".`,
              );
            }

            if (srcKind === "folder") {
              await moveFolder(newPath, srcPath);
            } else {
              await moveObject(newPath, srcPath);
            }
            invalidatePrefix(srcPath);
            invalidatePrefix(newPath);
            invalidatePath(srcParent);
            invalidatePath(destFolderPath);
            await refreshAfterMove(destFolderPath, srcParent);
            await onMoved?.(newPath, srcPath, srcKind);
          } catch (err) {
            // Converge cache + UI to the true state even on
            // a (partially) failed reverse so nothing is
            // left stale, then surface the error.
            invalidatePrefix(srcPath);
            invalidatePrefix(newPath);
            invalidatePath(srcParent);
            invalidatePath(destFolderPath);
            await refreshAfterMove(destFolderPath, srcParent);
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(humanizeStorageError(msg, "rename"));
          }
        });
      } catch (err) {
        toast.dismiss(movingId);
        rollback();
        invalidatePrefix(srcPath);
        invalidatePrefix(newPath);
        invalidatePath(srcParent);
        invalidatePath(destFolderPath);
        await refreshAfterMove(srcParent, destFolderPath);
        const msg = err instanceof Error ? err.message : String(err);
        // No undo toast on a partial/failed move.
        toastError(humanizeStorageError(msg, "rename"), "Move failed");
      }
    },
    [isDirector, removeFromGrid, refreshAfterMove, onMoved],
  );

  return { activeDragItem, handleDragStart, handleDragEnd };
}
