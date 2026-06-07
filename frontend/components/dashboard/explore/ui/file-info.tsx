import { File, FileText } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Maps a filename to a small file-type badge, label, and accent color. Shared by
 * the chat message attachments, inline citations, and the Sources panel so the
 * visual language for a document is identical everywhere it appears.
 */
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
          <div className="w-6 h-6 bg-red-500 rounded-lg text-[9px] font-bold text-white flex items-center justify-center">
            PDF
          </div>
        ),
        label: "PDF",
        color: "text-red-400",
      };
    case "doc":
    case "docx":
      return {
        icon: (
          <div className="w-6 h-6 bg-blue-600 rounded-lg text-[9px] font-bold text-white flex items-center justify-center">
            W
          </div>
        ),
        label: "DOCX",
        color: "text-blue-400",
      };
    case "txt":
      return {
        icon: (
          <div className="w-6 h-6 bg-blue-400 rounded-lg flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
        ),
        label: "TXT",
        color: "text-blue-300",
      };
    default:
      return {
        icon: <File className="w-6 h-6 text-sbi-muted" />,
        label: ext.toUpperCase() || "FILE",
        color: "text-sbi-muted",
      };
  }
}
