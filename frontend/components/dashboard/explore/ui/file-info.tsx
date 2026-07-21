import { File, FileText, Image as ImageIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Maps a filename to a small file-type badge, label, and accent color. Shared by
 * the chat message attachments, inline citations, and the Sources panel so the
 * visual language for a document is identical everywhere it appears.
 *
 * All badges share ONE tinted-neutral family (sbi-dark-card chip, sbi-dark-border
 * outline, muted glyph) — files are differentiated by their label/glyph, never by
 * saturated fills. Brand: restrained, no loud color.
 */

/** Shared monochrome chip wrapper for every file-type badge. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <div className="w-6 h-6 rounded-lg bg-sbi-dark-card border border-sbi-dark-border flex items-center justify-center text-sbi-muted">
      {children}
    </div>
  );
}

export function getFileInfo(filename: string): {
  icon: ReactNode;
  label: string;
  color: string;
} {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "pdf":
      return {
        icon: (
          <Chip>
            <span className="text-[8px] font-bold tracking-tight">PDF</span>
          </Chip>
        ),
        label: "PDF",
        color: "text-sbi-muted",
      };
    case "doc":
    case "docx":
      return {
        icon: (
          <Chip>
            <span className="text-[9px] font-bold">W</span>
          </Chip>
        ),
        label: "DOCX",
        color: "text-sbi-muted",
      };
    case "txt":
      return {
        icon: (
          <Chip>
            <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Chip>
        ),
        label: "TXT",
        color: "text-sbi-muted",
      };
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
      return {
        icon: (
          <Chip>
            <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Chip>
        ),
        label: "Image",
        color: "text-sbi-muted",
      };
    default:
      return {
        icon: (
          <Chip>
            <File className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Chip>
        ),
        label: ext.toUpperCase() || "FILE",
        color: "text-sbi-muted",
      };
  }
}
