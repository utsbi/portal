"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { StorageError } from "@supabase/storage-js";
import { FolderOpen, FolderPlus, Home, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  DashboardShell,
  EmptyState,
  Modal,
  PageHeader,
  Panel,
  SectionLabel,
  TextField,
} from "@/components/dashboard/common/ui";
import { KnowledgeSourcesPanel } from "@/components/dashboard/explore/ui/KnowledgeSourcesPanel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deletePortalFileIndex,
  indexPortalFile,
  listIndexedFiles,
} from "@/lib/api/knowledge";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import DragOverlayCard from "./DragOverlay";
import FileCard from "./FileCard";
import FolderCard from "./FolderCard";
import {
  deleteFolder,
  humanizeStorageError,
  invalidatePath,
  invalidatePrefix,
  isFolder,
  isInvalidMoveTarget,
  isSentinel,
  listFolder,
  moveFolder,
  moveObject,
  parentOf,
  removePaths,
  type StorageEntry,
  setStorageRoot,
  uploadFile,
} from "./storage";
import TreeNode, { type FolderNode } from "./TreeNode";
import { useDragMove } from "./useDragMove";

// File types the RAG ingester accepts. Uploading one of these auto-indexes it
// into the project's assistant corpus; anything else is "Not indexable".
const INDEXABLE_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "docx",
  "pptx",
  "xlsx",
]);

function isIndexable(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return INDEXABLE_EXTENSIONS.has(ext);
}

function SkeletonTile() {
  return (
    <div className="flex min-h-[3.75rem] items-center gap-3 border border-sbi-dark-border/50 rounded-lg px-4 py-3 bg-sbi-dark-card/30 animate-pulse">
      <div className="h-4 w-4 bg-white/5 rounded shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-3/5 bg-white/5 rounded mb-1.5" />
        <div className="h-3 w-2/5 bg-white/5 rounded" />
      </div>
    </div>
  );
}

function FolderSkeletonRow() {
  return (
    <li>
      <div className="flex items-center gap-2 px-2 py-1 animate-pulse">
        <span className="w-4" />
        <div className="h-3 w-32 bg-white/5 rounded" />
      </div>
    </li>
  );
}

export default function FilesPage() {
  const { user, activeProject } = useProject();
  const isDirector = user?.role === "director";
  const projectId = activeProject?.projectId ?? null;

  const [files, setFiles] = useState<StorageEntry[]>([]);
  const [subfolders, setSubfolders] = useState<FolderNode[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>("Media");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(["Media"]),
  );
  const [error, setError] = useState<StorageError | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingContents, setIsLoadingContents] = useState(true);

  // Write-op UI state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [renameTarget, setRenameTarget] = useState<{
    kind: "file" | "folder";
    name: string;
    path: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "file" | "folder";
    name: string;
    path: string;
  } | null>(null);

  // RAG index state. `indexedPaths` is the set of project-relative paths the
  // backend has embedded; `indexingPaths` are uploads whose index call is in
  // flight. Both drive the per-file badge.
  const [indexedPaths, setIndexedPaths] = useState<Set<string>>(new Set());
  const [indexingPaths, setIndexingPaths] = useState<Set<string>>(new Set());

  const refreshIndexedFiles = useCallback(async () => {
    if (projectId === null) return;
    try {
      const indexed = await listIndexedFiles(projectId);
      setIndexedPaths(new Set(indexed.map((f) => f.storage_path)));
    } catch {
      // Non-critical: the badge just won't show. Don't disrupt the page.
    }
  }, [projectId]);

  // Load the indexed list on mount and on project switch; clear stale state
  // first so a previous project's badges never bleed across the switch.
  useEffect(() => {
    setIndexedPaths(new Set());
    setIndexingPaths(new Set());
    if (projectId === null) return;
    void refreshIndexedFiles();
  }, [projectId, refreshIndexedFiles]);

  // ---------------------------------------------------------------------
  // Listing — cache-aware. Tree nodes resolve `hasSubfolders` up front by
  // probing each child (cached via listFolder, so revisits are free) so the
  // chevron is accurate immediately and never appears-then-disappears. This
  // probe is TREE-ONLY; the grid (fetchFolderContents) stays probe-free.
  // ---------------------------------------------------------------------

  const fetchFolderNodes = async (
    folderPath: string,
    force = false,
  ): Promise<FolderNode[]> => {
    const { data, error: fetchError } = await listFolder(folderPath, { force });
    if (fetchError) {
      setError(new StorageError(fetchError.message));
      return [];
    }
    const folders = data
      .filter((entry) => isFolder(entry))
      .map((folder) => ({
        name: folder.name,
        path: folderPath ? `${folderPath}/${folder.name}` : folder.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Promise.all(
      folders.map(async (f) => {
        const { data: childData } = await listFolder(f.path);
        return {
          ...f,
          hasSubfolders: (childData ?? []).some((e) => isFolder(e)),
        };
      }),
    );
  };

  // `isCancelled` lets a project-switch effect abort a stale in-flight load so
  // it can't overwrite the new project's contents after the switch.
  const fetchFolderContents = async (
    path: string,
    force = false,
    isCancelled?: () => boolean,
  ) => {
    setIsLoadingContents(true);
    const {
      data,
      error: fetchError,
      stale,
    } = await listFolder(path, {
      force,
    });
    // Clear the spinner even on the abort path: with two rapid switches
    // both in-flight loads can come back stale, and nothing else would
    // reset it.
    if (isCancelled?.() || stale) {
      setIsLoadingContents(false);
      return;
    }

    if (fetchError) {
      setError(new StorageError(fetchError.message));
      setIsLoadingContents(false);
      return;
    }
    setError(null);

    const folderEntries = data.filter((entry) => isFolder(entry));
    const fileEntries = data.filter(
      (entry) => !isFolder(entry) && !isSentinel(entry),
    );

    // No per-subfolder probe — the grid FolderCard never used it.
    const childFolders: FolderNode[] = folderEntries
      .map((folder) => ({
        name: folder.name,
        path: path ? `${path}/${folder.name}` : folder.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setSubfolders(childFolders);
    setFiles(fileEntries);
    setIsLoadingContents(false);
  };

  // Re-root storage on the active project and (re)load its tree. Fresh-start
  // scoping: every project sees only files under its own `{projectId}/`
  // prefix, so switching projects swaps the whole tree. Keyed on projectId so
  // it re-runs on switch; the storage root is set synchronously first, before
  // the contents effect below reads it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional project-keyed bootstrap
  useEffect(() => {
    setStorageRoot(projectId !== null ? String(projectId) : null);
    setFolderTree([]);
    setSubfolders([]);
    setFiles([]);

    if (projectId === null) {
      setIsLoadingTree(false);
      setIsLoadingContents(false);
      return;
    }

    // Project-switch guard: if the effect re-runs (project changed) while a
    // load is in flight, `cancelled` short-circuits every setState below so
    // a stale load can't overwrite the newly selected project's tree.
    let cancelled = false;

    const bootstrapFolders = async () => {
      setIsLoadingTree(true);
      const rootNodes = await fetchFolderNodes("", true);
      if (cancelled) return;
      setFolderTree(rootNodes);
      setIsLoadingTree(false);

      const mediaFolder = rootNodes.find(
        (node) => node.name.toLowerCase() === "media",
      );
      const target = mediaFolder ?? rootNodes[0];
      if (target) {
        setSelectedFolderPath(target.path);
        setExpandedPaths(new Set([target.path]));
        const children = await fetchFolderNodes(target.path, true);
        if (cancelled) return;
        setFolderTree((prev) =>
          markChildrenLoaded(prev, target.path, children),
        );
      } else {
        // Fresh project with no files yet — show the empty root.
        setSelectedFolderPath("");
        setExpandedPaths(new Set());
      }
    };

    void bootstrapFolders();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Reload the open folder's contents on navigation AND on project switch
  // (the path string may be unchanged across projects, so projectId is a dep).
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch is stable; project switch must force a reload
  useEffect(() => {
    if (projectId === null) return;
    let cancelled = false;
    void fetchFolderContents(selectedFolderPath, true, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [selectedFolderPath, projectId]);

  // ---------------------------------------------------------------------
  // Tree node helpers
  // ---------------------------------------------------------------------

  // Attach loaded children AND resolve the parent's lazy hasSubfolders:
  // empty => false (hides the chevron), non-empty => true.
  const markChildrenLoaded = (
    nodes: FolderNode[],
    targetPath: string,
    children: FolderNode[],
  ): FolderNode[] => {
    return nodes.map((node) => {
      if (node.path === targetPath) {
        return {
          ...node,
          children,
          hasSubfolders: children.length > 0,
        };
      }
      if (!node.children) return node;
      return {
        ...node,
        children: markChildrenLoaded(node.children, targetPath, children),
      };
    });
  };

  const findNodeByPath = (
    nodes: FolderNode[],
    targetPath: string,
  ): FolderNode | null => {
    for (const node of nodes) {
      if (node.path === targetPath) return node;
      if (node.children) {
        const match = findNodeByPath(node.children, targetPath);
        if (match) return match;
      }
    }
    return null;
  };

  const ensureNodeLoaded = async (nodePath: string, force = false) => {
    const node = findNodeByPath(folderTree, nodePath);
    if (!force && node?.children) return;
    const children = await fetchFolderNodes(nodePath, force);
    setFolderTree((prev) => markChildrenLoaded(prev, nodePath, children));
  };

  const handleSelectFolder = async (folderPath: string) => {
    setSelectedFolderPath(folderPath);
    await ensureNodeLoaded(folderPath);
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.add(folderPath);
      return next;
    });
  };

  // Whole tree row click. Explorer semantics:
  //  - collapsed folder        -> select + expand
  //  - expanded, NOT selected  -> just select (do NOT collapse — clicking a
  //                               sibling then back must not fold it)
  //  - expanded AND selected   -> collapse (only the already-active folder
  //                               toggles shut on re-click)
  // biome-ignore lint/correctness/useExhaustiveDependencies: ensureNodeLoaded is a non-memoized closure over folderTree; depending on folderTree (not the fn) keeps this callback fresh as the tree loads, without regenerating it every render
  const handleTreeNodeClick = useCallback(
    async (node: FolderNode) => {
      const wasSelected = selectedFolderPath === node.path;
      setSelectedFolderPath(node.path);

      // Confirmed-leaf nodes can't expand; unknown nodes still try.
      if (node.hasSubfolders === false) return;

      const isExpanded = expandedPaths.has(node.path);

      if (!isExpanded) {
        await ensureNodeLoaded(node.path);
        setExpandedPaths((prev) => new Set(prev).add(node.path));
        return;
      }

      // Already expanded: only fold shut when it was the active
      // selection.
      if (wasSelected) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(node.path);
          return next;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFolderPath, expandedPaths, folderTree],
  );

  // Droppable "Home / Root" zone in the tree sidebar header — lets items be
  // moved to storage root (id = "").
  const {
    setNodeRef: setRootDropRef,
    isOver: isRootOver,
    active: rootActive,
  } = useDroppable({
    id: "drop:root",
    data: { kind: "folder", name: "Home", path: "" },
  });

  // Highlight "Home" only when dropping there is a real move — i.e. the
  // dragged item isn't already a top-level entry.
  const rootActiveData = rootActive?.data.current as
    | { kind?: "file" | "folder"; path?: string }
    | undefined;
  const showRootDropRing =
    isRootOver &&
    !!rootActiveData?.path &&
    !!rootActiveData.kind &&
    !isInvalidMoveTarget(rootActiveData.path, rootActiveData.kind, "");

  const breadcrumbSegments = useMemo(() => {
    const parts = selectedFolderPath
      ? selectedFolderPath.split("/").filter(Boolean)
      : [];
    const segments: { label: string; path: string }[] = [
      { label: "Home", path: "" },
    ];
    let accumulated = "";
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      segments.push({ label: part, path: accumulated });
    }
    return segments;
  }, [selectedFolderPath]);

  const isEmpty =
    !isLoadingContents && subfolders.length === 0 && files.length === 0;

  // ---------------------------------------------------------------------
  // Write ops (directors only). All invalidate cache before re-listing.
  // ---------------------------------------------------------------------

  // Refresh current folder + its parent tree node so changes show up.
  const refreshAfterWrite = async () => {
    invalidatePath(selectedFolderPath);
    invalidatePath(parentOf(selectedFolderPath));
    await fetchFolderContents(selectedFolderPath, true);
    await ensureNodeLoaded(selectedFolderPath, true);
    // Refresh parent tree node so new/removed folders appear in the tree.
    const parent = parentOf(selectedFolderPath);
    if (parent !== selectedFolderPath) {
      const parentChildren = await fetchFolderNodes(parent, true);
      setFolderTree((prev) => markChildrenLoaded(prev, parent, parentChildren));
    }
  };

  // Force-relist both sides of a move (grid + tree) so the UI converges
  // after a drag-drop. `srcParent`/`destPath` are folder prefixes ("" =
  // root).
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchFolderContents/fetchFolderNodes/markChildrenLoaded are non-memoized render-scoped helpers; adding them would regenerate this callback every render and defeat its stable identity. selectedFolderPath is the only reactive value the logic branches on
  const refreshAfterMove = useCallback(
    async (srcParent: string, destPath: string) => {
      invalidatePath(srcParent);
      invalidatePath(destPath);

      // Refresh the currently-viewed grid if it's one of the two sides.
      if (selectedFolderPath === srcParent || selectedFolderPath === destPath) {
        await fetchFolderContents(selectedFolderPath, true);
      }

      // Refresh the affected tree nodes so folders move in the tree too.
      const sides = Array.from(new Set([srcParent, destPath]));
      for (const side of sides) {
        const children = await fetchFolderNodes(side, true);
        if (side === "") {
          setFolderTree(children);
        } else {
          setFolderTree((prev) => markChildrenLoaded(prev, side, children));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFolderPath],
  );

  // Optimistically drop a moved item out of the current grid; returns a
  // rollback that restores the prior grid state if the move fails.
  const removeFromGrid = useCallback(
    (srcPath: string, kind: "file" | "folder") => {
      const prevFolders = subfolders;
      const prevFiles = files;
      const srcName = srcPath.split("/").pop() as string;
      if (kind === "folder") {
        setSubfolders((prev) => prev.filter((f) => f.path !== srcPath));
      } else {
        setFiles((prev) => prev.filter((f) => f.name !== srcName));
      }
      return () => {
        setSubfolders(prevFolders);
        setFiles(prevFiles);
      };
    },
    [subfolders, files],
  );

  const { activeDragItem, handleDragStart, handleDragEnd } = useDragMove({
    isDirector,
    removeFromGrid,
    refreshAfterMove,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setIsUploading(true);
    setUploadCount(arr.length);

    let okCount = 0;
    const failures: string[] = [];
    const toIndex: string[] = [];
    for (const file of arr) {
      const targetPath = selectedFolderPath
        ? `${selectedFolderPath}/${file.name}`
        : file.name;
      const { error: upErr } = await uploadFile(targetPath, file);
      if (upErr) {
        failures.push(
          `${file.name}: ${humanizeStorageError(upErr.message, "upload")}`,
        );
      } else {
        okCount += 1;
        if (isIndexable(file.name)) toIndex.push(targetPath);
      }
    }

    setIsUploading(false);
    setUploadCount(0);

    if (okCount > 0) {
      toastSuccess(
        `${okCount} file${okCount === 1 ? "" : "s"} uploaded.`,
        "Upload complete",
      );
    }
    if (failures.length > 0) {
      toastError(failures.join(" • "), "Some uploads failed");
    }
    await refreshAfterWrite();

    // Best-effort auto-index of every newly uploaded indexable file. Each
    // path shows "Indexing…" while its call is in flight, then the refreshed
    // indexed-list flips it to "Indexed". A failed index just clears the
    // in-flight badge — the storage upload already succeeded.
    if (projectId !== null && toIndex.length > 0) {
      setIndexingPaths((prev) => {
        const next = new Set(prev);
        for (const p of toIndex) next.add(p);
        return next;
      });
      await Promise.all(
        toIndex.map(async (path) => {
          try {
            await indexPortalFile(projectId, path);
          } catch (err) {
            toastError(
              err instanceof Error
                ? err.message
                : `Couldn't index ${path.split("/").pop()}.`,
              "Indexing failed",
            );
          } finally {
            setIndexingPaths((prev) => {
              const next = new Set(prev);
              next.delete(path);
              return next;
            });
          }
        }),
      );
      await refreshIndexedFiles();
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleUploadFiles(e.target.files);
    }
    e.target.value = "";
  };

  // Drag & drop onto the grid area. Only react to genuine OS file drags
  // (dragging an in-page image/text is NOT a "Files" drag), and never while
  // a modal/preview is open (its Radix dialog is mounted with role=dialog).
  const dragHasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const aModalIsOpen = () =>
    typeof document !== "undefined" &&
    !!document.querySelector('[role="dialog"]');

  const onDragEnter = (e: React.DragEvent) => {
    if (!isDirector || aModalIsOpen() || !dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!isDirector || !isDragging) return;
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!isDirector || aModalIsOpen() || !dragHasFiles(e)) return;
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    if (!isDirector || aModalIsOpen()) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toastError("Folder name can't be empty.");
      return;
    }
    if (name.includes("/")) {
      toastError("Folder name can't contain a slash.");
      return;
    }
    setCreatingFolder(true);
    const prefix = selectedFolderPath ? `${selectedFolderPath}/${name}` : name;
    const { error: upErr } = await uploadFile(
      `${prefix}/.emptyFolderPlaceholder`,
      new Blob([]),
    );
    setCreatingFolder(false);

    if (upErr) {
      toastError(humanizeStorageError(upErr.message, "create"));
      return;
    }
    toastSuccess(`Folder "${name}" created.`);
    setNewFolderOpen(false);
    setNewFolderName("");
    await refreshAfterWrite();
  };

  const openRename = (kind: "file" | "folder", name: string, path: string) => {
    setRenameTarget({ kind, name, path });
    setRenameValue(name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const newName = renameValue.trim();
    if (!newName) {
      toastError("Name can't be empty.");
      return;
    }
    if (newName.includes("/")) {
      toastError("Name can't contain a slash.");
      return;
    }
    if (newName === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setRenaming(true);
    const prefix = parentOf(renameTarget.path);
    const newPath = prefix ? `${prefix}/${newName}` : newName;

    try {
      if (renameTarget.kind === "file") {
        await moveObject(renameTarget.path, newPath);
      } else {
        await moveFolder(renameTarget.path, newPath);
      }
      invalidatePrefix(renameTarget.path);
      invalidatePrefix(newPath);
      toastSuccess(
        `${renameTarget.kind === "file" ? "File" : "Folder"} renamed to "${newName}".`,
      );
      setRenameTarget(null);
      await refreshAfterWrite();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(humanizeStorageError(msg, "rename"));
    } finally {
      setRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      if (target.kind === "file") {
        await removePaths([target.path]);
      } else {
        await deleteFolder(target.path);
      }
      invalidatePrefix(target.path);
      invalidatePath(parentOf(target.path));
      toastSuccess(
        `${target.kind === "file" ? "File" : "Folder"} "${target.name}" deleted.`,
      );
      setDeleteTarget(null);
      await refreshAfterWrite();

      // Best-effort cascade into the RAG index — never block or fail the
      // storage delete on it. For a file, drop its single index; for a
      // folder, drop every indexed path under that prefix.
      if (projectId !== null) {
        const prefix = `${target.path}/`;
        const toUnindex =
          target.kind === "file"
            ? indexedPaths.has(target.path)
              ? [target.path]
              : []
            : Array.from(indexedPaths).filter((p) => p.startsWith(prefix));
        if (toUnindex.length > 0) {
          await Promise.all(
            toUnindex.map((p) =>
              deletePortalFileIndex(projectId, p).catch(() => {}),
            ),
          );
          await refreshIndexedFiles();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(humanizeStorageError(msg, "delete"));
    }
  };

  return (
    <DashboardShell>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        autoScroll={{
          threshold: { x: 0.1, y: 0.15 },
          acceleration: 12,
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <PageHeader
          title="Client Document Portal"
          subtitle="Browse and download files shared on your project."
        />

        <div className="flex flex-1 min-h-0 gap-6">
          {/* Folder tree sidebar */}
          <Panel
            className="hidden w-64 shrink-0 overflow-y-auto md:block"
            padded
          >
            <SectionLabel className="mb-4">Folders</SectionLabel>
            {/* Home / Root droppable — move items to storage root. */}
            <button
              ref={setRootDropRef}
              type="button"
              onClick={() => void handleSelectFolder("")}
              className={`group mb-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ${
                showRootDropRing
                  ? "border border-sbi-green/40 bg-sbi-green/10 [animation:sbiDragPulse_1.1s_ease-in-out_infinite]"
                  : "border border-transparent"
              } ${
                selectedFolderPath === ""
                  ? "bg-sbi-green/10 text-sbi-green"
                  : "text-sbi-muted hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <span className="size-3.5 shrink-0" />
              <Home
                className={`size-4 shrink-0 transition-colors ${
                  selectedFolderPath === ""
                    ? "text-sbi-green"
                    : "text-sbi-muted group-hover:text-white"
                }`}
              />
              <span className="flex-1 truncate leading-none">Home</span>
            </button>
            {isLoadingTree ? (
              <ul className="space-y-2 text-sm">
                {Array.from({ length: 5 }, (_, i) => `tree-skeleton-${i}`).map(
                  (key) => (
                    <FolderSkeletonRow key={key} />
                  ),
                )}
              </ul>
            ) : folderTree.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {folderTree.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    level={0}
                    expandedPaths={expandedPaths}
                    selectedFolderPath={selectedFolderPath}
                    onNodeClick={handleTreeNodeClick}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-2 py-1 text-xs font-light text-sbi-muted-dark">
                No folders yet
              </p>
            )}

            {/* Read-only disclosure of the project's RAG corpus — what
                        the Explore assistant can read. Indexing happens via the
                        Upload button above; this panel no longer uploads. */}
            <KnowledgeSourcesPanel className="mt-4" />
          </Panel>

          <main className="flex-1 min-w-0 overflow-y-auto flex flex-col">
            {/* Breadcrumb + director toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <nav
                aria-label="Folder breadcrumb"
                className="text-sm text-sbi-muted flex flex-wrap items-center gap-1"
              >
                {breadcrumbSegments.map((seg, i) => {
                  const isLast = i === breadcrumbSegments.length - 1;
                  return (
                    <span
                      key={`${seg.path}-${i}`}
                      className="flex items-center gap-1"
                    >
                      {isLast ? (
                        <span className="text-white">{seg.label}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectFolder(seg.path)}
                          className="cursor-pointer hover:text-sbi-green transition-colors"
                        >
                          {seg.label}
                        </button>
                      )}
                      {!isLast && <span className="text-sbi-muted/40">/</span>}
                    </span>
                  );
                })}
              </nav>

              {isDirector ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={onFileInputChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={btnPrimary}
                  >
                    {isUploading ? (
                      <>
                        <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Uploading {uploadCount}…
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewFolderName("");
                      setNewFolderOpen(true);
                    }}
                    disabled={isUploading}
                    className={btnGhost}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    New Folder
                  </button>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="text-sm text-red-400 mb-6 shrink-0">
                {error.message || "Failed to load files or folders."}
              </div>
            ) : null}

            {/* biome-ignore lint/a11y/noStaticElementInteractions: native HTML5 file-drop region; drop is a pointer-only affordance with an equivalent keyboard-accessible Upload button above, so a role/keyboard handler here would be misleading */}
            <div
              className="relative flex-1 flex flex-col"
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              {isDirector && isDragging ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-sbi-green/30 bg-sbi-dark/80 backdrop-blur-sm pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-sbi-green">
                    <Upload className="h-7 w-7" />
                    <span className="text-sm font-medium tracking-wide">
                      Drop files to upload
                    </span>
                  </div>
                </div>
              ) : null}

              {isEmpty ? (
                <EmptyState
                  icon={<FolderOpen size={24} />}
                  title="This folder is empty"
                  description="No files or subfolders have been added here yet."
                />
              ) : (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                  {isLoadingContents ? (
                    Array.from(
                      { length: 6 },
                      (_, i) => `content-skeleton-${i}`,
                    ).map((key) => <SkeletonTile key={key} />)
                  ) : (
                    <>
                      {subfolders.map((folder) => (
                        <FolderCard
                          key={folder.path}
                          name={folder.name}
                          draggableId={folder.path}
                          droppableId={folder.path}
                          canManage={isDirector}
                          onOpen={() => handleSelectFolder(folder.path)}
                          onRename={() =>
                            openRename("folder", folder.name, folder.path)
                          }
                          onDelete={() =>
                            setDeleteTarget({
                              kind: "folder",
                              name: folder.name,
                              path: folder.path,
                            })
                          }
                        />
                      ))}
                      {files.map((item) => {
                        const fullPath = selectedFolderPath
                          ? `${selectedFolderPath}/${item.name}`
                          : item.name;
                        const indexState = indexingPaths.has(fullPath)
                          ? "indexing"
                          : indexedPaths.has(fullPath)
                            ? "indexed"
                            : isIndexable(item.name)
                              ? undefined
                              : "not-indexable";
                        return (
                          <FileCard
                            key={item.name}
                            name={item.name}
                            folderPath={selectedFolderPath}
                            draggableId={fullPath}
                            updatedAt={item.updated_at}
                            canManage={isDirector}
                            indexState={indexState}
                            onRename={() =>
                              openRename("file", item.name, fullPath)
                            }
                            onDelete={() =>
                              setDeleteTarget({
                                kind: "file",
                                name: item.name,
                                path: fullPath,
                              })
                            }
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* New Folder modal */}
        <Modal
          opened={newFolderOpen}
          onClose={() => !creatingFolder && setNewFolderOpen(false)}
          title="New Folder"
          size="md"
        >
          <div>
            <TextField
              label="Folder name"
              placeholder="e.g. Contracts"
              value={newFolderName}
              onChange={setNewFolderName}
              disabled={creatingFolder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateFolder();
              }}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                disabled={creatingFolder}
                className={btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateFolder()}
                disabled={creatingFolder}
                className={btnPrimary}
              >
                {creatingFolder ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </Modal>

        {/* Rename modal */}
        <Modal
          opened={renameTarget !== null}
          onClose={() => !renaming && setRenameTarget(null)}
          title={`Rename ${renameTarget?.kind === "folder" ? "Folder" : "File"}`}
          size="md"
        >
          <div>
            <TextField
              label="New name"
              value={renameValue}
              onChange={setRenameValue}
              disabled={renaming}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRename();
              }}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                disabled={renaming}
                className={btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRename()}
                disabled={renaming}
                className={btnPrimary}
              >
                {renaming ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Renaming…
                  </>
                ) : (
                  "Rename"
                )}
              </button>
            </div>
          </div>
        </Modal>

        {/* Delete confirmation */}
        <ConfirmDialog
          opened={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          danger
          title={
            deleteTarget?.kind === "folder" ? "Delete folder" : "Delete file"
          }
          description={
            deleteTarget?.kind === "folder" ? (
              <>
                This permanently deletes{" "}
                <span className="text-white font-medium">
                  {deleteTarget?.name}
                </span>{" "}
                and every file and subfolder inside it. This cannot be undone.
              </>
            ) : (
              <>
                This permanently deletes{" "}
                <span className="text-white font-medium">
                  {deleteTarget?.name}
                </span>
                . This cannot be undone.
              </>
            )
          }
          confirmLabel="Delete"
          confirmationText={
            deleteTarget?.kind === "folder" ? deleteTarget.name : undefined
          }
          onConfirm={handleConfirmDelete}
        />

        <DragOverlay dropAnimation={null}>
          {activeDragItem ? (
            <DragOverlayCard
              name={activeDragItem.name}
              kind={activeDragItem.kind}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </DashboardShell>
  );
}
