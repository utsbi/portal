"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAttachmentContent } from "@/lib/api/chat";
import { cn } from "@/lib/utils";

export interface GalleryAttachment {
  filename: string;
  content?: string;
  hash?: string;
  file_type?: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;

/** True when an attachment should render as an image (thumbnail + lightbox). */
export function isImageAttachment(a: GalleryAttachment): boolean {
  return a.file_type === "image" || IMAGE_EXT_RE.test(a.filename);
}

interface ResolvedImage {
  src: string;
  alt: string;
  filename: string;
}

/**
 * Renders image attachments as a row of thumbnails that share ONE lightbox modal
 * with prev/next navigation (arrow keys, on-screen chevrons, a counter, and
 * Esc/backdrop close). Used by the composer (pending images, inline data URLs +
 * a remove button) and by sent chat messages (data URLs resolved from
 * client_chat_attachments by hash on reload).
 *
 * Returns a fragment of thumbnail buttons so they flow as flex children of the
 * caller's attachment row; the fixed-position lightbox overlays the whole page.
 */
export function ImageAttachmentGallery({
  attachments,
  thumbClassName,
  onRemove,
}: {
  attachments: GalleryAttachment[];
  thumbClassName?: string;
  onRemove?: (filename: string) => void;
}) {
  // Data URLs resolved from a hash reference (sent messages on reload). Composer
  // and live-message images already carry the URL inline, so they never fetch.
  const [resolved, setResolved] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    for (const a of attachments) {
      const hasInline = a.content?.startsWith("data:image/");
      if (hasInline || !a.hash || resolved[a.hash]) continue;
      const hash = a.hash;
      getAttachmentContent(hash).then((r) => {
        if (!cancelled && r?.content?.startsWith("data:image/")) {
          setResolved((prev) => ({ ...prev, [hash]: r.content as string }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [attachments, resolved]);

  const images: ResolvedImage[] = [];
  for (const a of attachments) {
    const src = a.content?.startsWith("data:image/")
      ? a.content
      : a.hash
        ? resolved[a.hash]
        : undefined;
    if (src) images.push({ src, alt: a.filename, filename: a.filename });
  }

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const count = images.length;

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // Lock background scroll while the lightbox is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, step]);

  if (count === 0) return null;

  const active =
    openIndex !== null && openIndex < count ? images[openIndex] : null;

  return (
    <>
      {images.map((img, i) => (
        <div key={img.filename} className="relative">
          <button
            type="button"
            onClick={() => setOpenIndex(i)}
            aria-label={`Preview ${img.alt}`}
            className={cn(
              "block overflow-hidden rounded-xl border border-sbi-dark-border bg-sbi-dark-card transition-opacity hover:opacity-90",
              thumbClassName,
            )}
          >
            {/* biome-ignore lint/performance/noImgElement: base64 data: URLs can't use next/image */}
            <img
              src={img.src}
              alt={img.alt}
              draggable={false}
              className="h-full w-full object-cover"
            />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(img.filename)}
              aria-label={`Remove ${img.filename}`}
              className="absolute -right-1.5 -top-1.5 rounded-full border border-sbi-dark-border bg-sbi-dark p-0.5 text-sbi-muted transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {active &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={active.alt}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          >
            {/* Full-area backdrop close target (a real, keyboard-reachable button). */}
            <button
              type="button"
              onClick={close}
              aria-label="Close preview"
              className="absolute inset-0 cursor-default"
            />

            <button
              type="button"
              onClick={close}
              aria-label="Close preview"
              className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-5" />
            </button>

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous image"
                  className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next image"
                  className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="size-6" />
                </button>
                <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white tabular-nums">
                  {(openIndex ?? 0) + 1} / {count}
                </div>
              </>
            )}

            {/* biome-ignore lint/performance/noImgElement: base64 data: URLs can't use next/image */}
            <img
              src={active.src}
              alt={active.alt}
              className="pointer-events-none relative z-10 max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
