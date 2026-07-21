"use client";

import {
  Building,
  Calendar as CalendarIcon,
  FileText,
  Folder,
  Mail,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import { StatusPill } from "@/components/data-table";
import { departmentLabel } from "@/lib/departments";
import { toastError, toastSuccess } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import type { RequestStatus } from "@/lib/supabase/requests";
import { updateRequestStatus } from "@/lib/supabase/requests";
import { cn } from "@/lib/utils";
import { memberLabel } from "./constants";
import type { Request } from "./RequestHistory";

const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "denied", label: "Denied" },
];

const BUCKET = "ticket-attachments";
const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "heic",
]);

interface RequestDetailModalProps {
  request: Request | null;
  onClose: () => void;
  canEditStatus?: boolean;
  onStatusChange?: (id: string, status: RequestStatus) => void;
}

function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ? IMAGE_EXTS.has(ext) : false;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-sbi-green mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted mb-0.5">
          {label}
        </p>
        <p className="text-sm text-white truncate">{value}</p>
      </div>
    </div>
  );
}

interface AttachmentFile {
  id: string;
  name: string;
  size: string;
}

function AttachmentItem({ attachment }: { attachment: AttachmentFile }) {
  const path = attachment.id; // the lib stores the storage path under `id`
  const name = attachment.name;
  const showImage = isImage(name);

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoadError(error?.message ?? "Could not load attachment");
          return;
        }
        setSignedUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (showImage) {
    return (
      <li className="rounded-lg border border-sbi-dark-border/40 bg-sbi-dark-card/40 overflow-hidden">
        {signedUrl ? (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            {/* biome-ignore lint/performance/noImgElement: signed URLs aren't compatible with next/image without remote config */}
            <img
              src={signedUrl}
              alt={name}
              className="w-full max-h-64 object-contain bg-black/30 group-hover:opacity-95 transition-opacity"
            />
          </a>
        ) : (
          <div className="w-full h-32 flex items-center justify-center text-xs text-sbi-muted">
            {loadError ? "Couldn't load preview" : "Loading preview…"}
          </div>
        )}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <FileText className="h-4 w-4 text-sbi-muted shrink-0" />
          <span className="text-sm text-white/90 flex-1 truncate">{name}</span>
          {attachment.size && (
            <span className="text-xs text-sbi-muted tabular-nums">
              {attachment.size}
            </span>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-sbi-dark-border/40 bg-sbi-dark-card/40 px-3 py-2.5 text-sm">
      <FileText className="h-4 w-4 text-sbi-muted shrink-0" />
      {signedUrl ? (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/90 flex-1 truncate hover:text-sbi-green transition-colors"
        >
          {name}
        </a>
      ) : (
        <span className="text-white/90 flex-1 truncate">{name}</span>
      )}
      {attachment.size && (
        <span className="text-xs text-sbi-muted tabular-nums">
          {attachment.size}
        </span>
      )}
    </li>
  );
}

export function RequestDetailModal({
  request,
  onClose,
  canEditStatus = false,
  onStatusChange,
}: RequestDetailModalProps) {
  const [savingStatus, setSavingStatus] = useState<RequestStatus | null>(null);

  if (!request) return null;

  const handleStatusChange = async (next: RequestStatus) => {
    if (next === request.status || savingStatus) return;
    setSavingStatus(next);
    const ok = await updateRequestStatus(request.id, next);
    setSavingStatus(null);
    if (ok) {
      toastSuccess(`Status set to ${next.replace("-", " ")}.`);
      onStatusChange?.(request.id, next);
    } else {
      toastError("Couldn't update status.");
    }
  };

  const title = (
    <span className="flex items-center gap-3">
      <span className="truncate text-white normal-case tracking-normal">
        {request.subject}
      </span>
      <StatusPill status={request.status} />
    </span>
  );

  const attachments = request.attachments ?? [];

  const footer = canEditStatus ? (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted shrink-0">
        Set status
      </span>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = request.status === opt.value;
          const isSaving = savingStatus === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              disabled={savingStatus !== null}
              aria-pressed={isActive}
              className={cn(
                isActive ? btnPrimary : btnGhost,
                "h-9 px-4 text-[11px]",
                isActive && "shadow-[inset_0_0_0_1px_var(--color-sbi-green)]",
              )}
            >
              {isSaving ? "Saving…" : opt.label}
            </button>
          );
        })}
      </div>
    </div>
  ) : undefined;

  return (
    <Modal
      opened={!!request}
      onClose={onClose}
      title={title}
      uppercaseTitle={false}
      size="xl"
      padded={false}
      footer={footer}
    >
      <div className="grid md:grid-cols-[260px_1fr] gap-0 md:gap-px bg-sbi-dark-border/30">
        <aside className="bg-sbi-dark p-6 flex flex-col gap-5">
          <MetaRow icon={User} label="From" value={request.name || "—"} />
          <MetaRow icon={Mail} label="Email" value={request.email || "—"} />
          <MetaRow
            icon={Building}
            label="Department"
            value={departmentLabel(request.department)}
          />
          <MetaRow
            icon={User}
            label="Assigned To"
            value={memberLabel(request.assignedTo)}
          />
          <MetaRow
            icon={Folder}
            label="Project"
            value={request.project || "—"}
          />
          <MetaRow
            icon={CalendarIcon}
            label="Created"
            value={formatDate(request.createdAt)}
          />
          {request.updatedAt && (
            <MetaRow
              icon={CalendarIcon}
              label="Last Updated"
              value={formatDateTime(request.updatedAt)}
            />
          )}
        </aside>

        <main className="bg-sbi-dark p-6 flex flex-col gap-6 min-w-0">
          <section>
            <h3 className="text-xs uppercase tracking-[0.15em] text-sbi-muted mb-3">
              Message
            </h3>
            {request.message ? (
              <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                {request.message}
              </p>
            ) : (
              <p className="text-sm text-sbi-muted italic">
                No message provided.
              </p>
            )}
          </section>

          {attachments.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-[0.15em] text-sbi-muted mb-3">
                Attachments
              </h3>
              <ul className="flex flex-col gap-3">
                {attachments.map((a) => (
                  <AttachmentItem key={a.id} attachment={a} />
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </Modal>
  );
}
