"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Folder, Pencil, Trash2 } from "lucide-react";
import { isInvalidMoveTarget } from "./storage";

interface FolderCardProps {
  name: string;
  draggableId: string;
  droppableId: string;
  onOpen: () => void;
  canManage?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
}

export default function FolderCard({
  name,
  draggableId,
  droppableId,
  onOpen,
  canManage = false,
  onRename,
  onDelete,
}: FolderCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag:folder:${draggableId}`,
    data: { kind: "folder", name, path: draggableId },
    disabled: !canManage,
  });

  const {
    setNodeRef: setDropRef,
    isOver,
    active,
  } = useDroppable({
    id: `drop:grid:${droppableId}`,
    data: { kind: "folder", name, path: droppableId },
  });

  // Only highlight as a drop target when a drop here would actually move
  // something — not onto itself, its own subtree, or its current parent.
  const activeData = active?.data.current as
    | { kind?: "file" | "folder"; path?: string }
    | undefined;
  const showDropRing =
    isOver &&
    !!activeData?.path &&
    !!activeData.kind &&
    !isInvalidMoveTarget(activeData.path, activeData.kind, droppableId);

  const setNodeRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setNodeRef}
      {...(canManage ? listeners : {})}
      className={`group relative flex min-h-[3.75rem] items-center gap-3 overflow-hidden border rounded-lg px-4 py-3 transition-colors ${
        canManage
          ? isDragging
            ? "opacity-40 cursor-grabbing"
            : "cursor-grab"
          : ""
      } ${
        showDropRing
          ? "ring-1 ring-inset ring-sbi-green/40 border-sbi-green/40 bg-sbi-dark-card/70"
          : "border-sbi-dark-border/50 hover:border-sbi-green/40 bg-sbi-dark-card/40 hover:bg-sbi-dark-card/60"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        title={name}
        className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
          canManage
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-pointer"
        }`}
        {...(canManage ? attributes : {})}
      >
        <Folder className="h-4 w-4 text-sbi-muted shrink-0" />
        <span className="text-sm font-medium text-white truncate leading-none">
          {name}
        </span>
      </button>
      {canManage ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center gap-1 pl-8 pr-3 bg-gradient-to-l from-sbi-dark-card via-sbi-dark-card to-transparent opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100">
          <button
            type="button"
            onClick={onRename}
            aria-label={`Rename ${name}`}
            title="Rename"
            className="cursor-pointer p-1.5 max-sm:p-2.5 rounded-md text-sbi-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
            title="Delete"
            className="cursor-pointer p-1.5 max-sm:p-2.5 rounded-md text-sbi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
