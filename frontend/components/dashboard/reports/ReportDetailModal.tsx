"use client";

import {
  Building,
  Calendar as CalendarIcon,
  CheckCircle2,
  FileText,
  Folder,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import { btnPrimary, Modal } from "@/components/dashboard/common/ui";
import { StatusPill } from "@/components/data-table";
import { departmentLabel } from "@/lib/departments";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";

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

interface ReportDetailModalProps {
  report: ReportItem | null;
  onClose: () => void;
  onAcknowledge?: (reportId: string) => Promise<boolean>;
}

interface AttachmentMeta {
  name?: string;
  path?: string;
  size?: string;
}

function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ? IMAGE_EXTS.has(ext) : false;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
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

function AttachmentItem({ attachment }: { attachment: AttachmentMeta }) {
  const name = attachment.name ?? attachment.path ?? "Untitled";
  const path = attachment.path;
  const showImage = path && isImage(name);

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

export function ReportDetailModal({
  report,
  onClose,
  onAcknowledge,
}: ReportDetailModalProps) {
  const { user } = useProject();
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  if (!report) return null;

  const canAcknowledge =
    Boolean(onAcknowledge) &&
    report.status === "Pending" &&
    user?.role === "client";

  const handleAcknowledge = async () => {
    if (!onAcknowledge) return;
    setIsAcknowledging(true);
    const ok = await onAcknowledge(report.id);
    setIsAcknowledging(false);
    if (ok) {
      toastSuccess(`Acknowledged "${report.title}".`);
    } else {
      toastError("Couldn't update report status. Try again.");
    }
  };

  const title = (
    <span className="flex items-center gap-3">
      <span className="truncate text-white normal-case tracking-normal">
        {report.title}
      </span>
      <StatusPill status={report.status} />
      <span className="text-xs text-sbi-muted tabular-nums normal-case tracking-normal">
        #{report.numid}
      </span>
    </span>
  );

  const attachments = Array.isArray(report.attachments)
    ? (report.attachments as AttachmentMeta[])
    : [];

  return (
    <Modal
      opened={!!report}
      onClose={onClose}
      title={title}
      uppercaseTitle={false}
      size="xl"
      padded={false}
    >
      <div className="grid md:grid-cols-[260px_1fr] gap-0 md:gap-px bg-sbi-dark-border/30">
        <aside className="bg-sbi-dark p-6 flex flex-col gap-5">
          <MetaRow
            icon={Folder}
            label="Project"
            value={report.project || "—"}
          />
          <MetaRow
            icon={Building}
            label="Department"
            value={departmentLabel(report.department)}
          />
          <MetaRow
            icon={User}
            label="Assigned Director"
            value={report.director}
          />
          <MetaRow
            icon={CalendarIcon}
            label="Submitted"
            value={formatDate(report.date)}
          />
          {report.updated_at && (
            <MetaRow
              icon={CalendarIcon}
              label="Last Updated"
              value={formatDateTime(report.updated_at)}
            />
          )}
        </aside>

        <main className="bg-sbi-dark p-6 flex flex-col gap-6 min-w-0">
          <section>
            <h3 className="text-xs uppercase tracking-[0.15em] text-sbi-muted mb-3">
              Summary
            </h3>
            {report.message ? (
              <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                {report.message}
              </p>
            ) : (
              <p className="text-sm text-sbi-muted italic">
                No summary provided by the director.
              </p>
            )}
          </section>

          {attachments.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-[0.15em] text-sbi-muted mb-3">
                Attachments
              </h3>
              <ul className="flex flex-col gap-3">
                {attachments.map((a, i) => (
                  <AttachmentItem key={a.path ?? i} attachment={a} />
                ))}
              </ul>
            </section>
          )}

          {canAcknowledge && (
            <div className="pt-4 border-t border-sbi-dark-border/40 flex justify-end">
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={isAcknowledging}
                className={btnPrimary}
              >
                {isAcknowledging ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Marking…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Acknowledged
                  </>
                )}
              </button>
            </div>
          )}
        </main>
      </div>
    </Modal>
  );
}
