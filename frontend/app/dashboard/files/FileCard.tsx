"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileAudio,
  FileCode2,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/dashboard/common/Modal";
import { toastError } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

type IndexState = "indexed" | "indexing" | "not-indexable";

interface FileCardProps {
  name: string;
  folderPath: string;
  draggableId: string;
  updatedAt?: string | null;
  canManage?: boolean;
  indexState?: IndexState;
  onRename?: () => void;
  onDelete?: () => void;
}

type PreviewKind = "image" | "pdf" | "video" | "audio" | "other";

const supabase = createClient();

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function iconForExtension(name: string): LucideIcon {
  const ext = extOf(name);
  if (
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif"].includes(ext)
  )
    return FileImage;
  if (["pdf", "doc", "docx", "rtf", "txt", "md"].includes(ext)) return FileText;
  if (["xls", "xlsx", "csv", "numbers"].includes(ext)) return FileSpreadsheet;
  if (
    ["js", "ts", "tsx", "jsx", "json", "yml", "yaml", "html", "css"].includes(
      ext,
    )
  )
    return FileCode2;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return FileVideo;
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return FileAudio;
  return FileIcon;
}

// What can render inline in a browser, vs. needs a download/new-tab fallback.
function previewKind(name: string): PreviewKind {
  const ext = extOf(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext))
    return "image";
  if (ext === "pdf") return "pdf";
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "flac"].includes(ext)) return "audio";
  return "other";
}

export default function FileCard({
  name,
  folderPath,
  draggableId,
  updatedAt,
  canManage = false,
  indexState,
  onRename,
  onDelete,
}: FileCardProps) {
  const Icon = iconForExtension(name);
  const kind = previewKind(name);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag:file:${draggableId}`,
    data: { kind: "file", name, path: draggableId },
    disabled: !canManage,
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Longer TTL so a preview (esp. video) doesn't expire mid-view.
  // `download` makes Supabase set Content-Disposition: attachment via the
  // signed URL itself — never string-append `?download`, the URL already
  // carries a `?token=` query and a second `?` corrupts the JWT.
  const getSignedUrl = async (
    opts?: { download?: string },
    expiresIn = 3600,
  ): Promise<string | null> => {
    const fullPath = folderPath ? `${folderPath}/${name}` : name;
    try {
      const { data, error } = await supabase.storage
        .from("Files")
        .createSignedUrl(
          fullPath,
          expiresIn,
          opts?.download ? { download: opts.download } : undefined,
        );
      if (error) {
        console.error("File URL error:", error);
        toastError(
          `Couldn't open ${name}. ${error.message ?? "Please try again."}`,
        );
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      console.error("Unexpected file URL error:", err);
      toastError(`Couldn't open ${name}.`);
      return null;
    }
  };

  const handlePreview = async () => {
    if (loadingPreview) return;
    setLoadingPreview(true);
    const signedUrl = await getSignedUrl();
    setLoadingPreview(false);
    if (!signedUrl) return;
    setPreviewUrl(signedUrl);
    setPreviewOpen(true);
  };

  const handleOpenInNewTab = () => {
    if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    // Always mint a fresh signed URL with the download disposition — the
    // inline previewUrl renders in-tab and has no attachment header.
    const signedUrl = await getSignedUrl({ download: name });
    if (!signedUrl) return;

    const link = document.createElement("a");
    link.href = signedUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  return (
    <>
      <div
        ref={setDragRef}
        {...(canManage ? listeners : {})}
        className={`group relative flex min-h-[3.75rem] items-center gap-3 overflow-hidden border border-sbi-dark-border/50 rounded-lg px-4 py-3 hover:border-sbi-green/40 transition-colors bg-sbi-dark-card/40 ${
          canManage
            ? isDragging
              ? "opacity-40 cursor-grabbing"
              : "cursor-grab"
            : ""
        }`}
      >
        <Icon className="h-4 w-4 text-sbi-muted shrink-0" />
        <div className="min-w-0 flex-1" {...(canManage ? attributes : {})}>
          <div className="text-sm font-medium text-white truncate" title={name}>
            {name}
          </div>
          <div className="flex items-center gap-2 text-xs text-sbi-muted">
            <span>{formattedDate}</span>
            {indexState === "indexing" ? (
              <span
                className="inline-flex items-center gap-1 text-sbi-green/80"
                title="Indexing into the assistant's sources"
              >
                <span className="block h-2.5 w-2.5 rounded-full border-[1.5px] border-sbi-green/70 border-t-transparent animate-spin" />
                Indexing…
              </span>
            ) : indexState === "indexed" ? (
              <span
                className="inline-flex items-center gap-1 text-sbi-green/80"
                title="The assistant can read this file"
              >
                <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                Indexed
              </span>
            ) : indexState === "not-indexable" ? (
              <span
                className="text-sbi-muted-dark"
                title="This file type isn't indexed for the assistant"
              >
                Not indexable
              </span>
            ) : null}
          </div>
        </div>
        {/* Actions sit over the row's right edge on an opaque fade so
                    the filename stays crisp (never blurred) and just runs
                    under them when long. Single opacity reveal — no scale,
                    no stagger, no layout animation. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center gap-1 pl-8 pr-3 bg-gradient-to-l from-sbi-dark-card via-sbi-dark-card to-transparent opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <button
            type="button"
            onClick={handlePreview}
            disabled={loadingPreview}
            aria-label={`Preview ${name}`}
            title="Preview"
            className="cursor-pointer p-1.5 rounded-md text-sbi-muted hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-default transition-colors"
          >
            {loadingPreview ? (
              <span className="block h-4 w-4 rounded-full border-2 border-sbi-muted border-t-transparent animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            aria-label={`Download ${name}`}
            title="Download"
            className="cursor-pointer p-1.5 rounded-md text-sbi-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <Download className="h-4 w-4" />
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                onClick={onRename}
                aria-label={`Rename ${name}`}
                title="Rename"
                className="cursor-pointer p-1.5 rounded-md text-sbi-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${name}`}
                title="Delete"
                className="cursor-pointer p-1.5 rounded-md text-sbi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <Modal
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={name}
        uppercaseTitle={false}
        size="xl"
        padded={false}
        headerActions={
          <>
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-sbi-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-sbi-green/30 bg-sbi-green/10 text-sbi-green hover:bg-sbi-green hover:text-sbi-dark transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </>
        }
      >
        <div className="p-4">
          {previewUrl && kind === "image" && (
            // biome-ignore lint/performance/noImgElement: signed URLs aren't compatible with next/image without remote config
            <img
              src={previewUrl}
              alt={name}
              className="mx-auto max-h-[75vh] w-auto object-contain"
            />
          )}
          {previewUrl && kind === "pdf" && (
            <iframe
              src={previewUrl}
              title={name}
              className="w-full h-[78vh] rounded-md bg-white"
            />
          )}
          {previewUrl && kind === "video" && (
            // biome-ignore lint/a11y/useMediaCaption: user-uploaded media of arbitrary origin has no caption track available
            <video
              src={previewUrl}
              controls
              autoPlay
              className="mx-auto max-h-[78vh] w-full rounded-md bg-sbi-dark"
            />
          )}
          {previewUrl && kind === "audio" && (
            <div className="py-16">
              {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded media of arbitrary origin has no caption track available */}
              <audio src={previewUrl} controls className="w-full" />
            </div>
          )}
          {kind === "other" && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <FileIcon className="h-10 w-10 text-sbi-muted-dark" />
              <p className="text-sm text-white">
                This file type can&apos;t be previewed here.
              </p>
              <p className="text-xs text-sbi-muted max-w-sm">
                Use Download or Open in new tab to view it.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
