"use client";

import { File as FileIcon, Folder } from "lucide-react";
import { motion } from "motion/react";

export interface DragOverlayCardProps {
  name: string;
  kind: "file" | "folder";
}

/**
 * Ghost card rendered inside @dnd-kit's <DragOverlay> while an item is being
 * dragged. Matches the FolderCard/FileCard shell so the dragged item reads as
 * "lifted": same border/padding, plus a slight scale, stronger shadow and a
 * faint green ring.
 */
export default function DragOverlayCard({ name, kind }: DragOverlayCardProps) {
  const Icon = kind === "folder" ? Folder : FileIcon;

  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="flex min-h-[3.75rem] w-[220px] cursor-grabbing items-center gap-3 overflow-hidden rounded-lg border border-sbi-dark-border/50 bg-sbi-dark-card/90 px-4 py-3 opacity-90 scale-[1.03] shadow-2xl ring-1 ring-sbi-green/30 backdrop-blur-sm"
    >
      <Icon className="h-4 w-4 shrink-0 text-sbi-green/70" />
      <span
        className="truncate text-sm font-medium leading-none text-white"
        title={name}
      >
        {name}
      </span>
    </motion.div>
  );
}
