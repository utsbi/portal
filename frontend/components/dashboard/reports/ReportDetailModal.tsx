"use client";

import { Building, Calendar as CalendarIcon, FileText, Folder, User } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { StatusPill } from "@/components/data-table";
import { Modal } from "@/components/dashboard/common/ui";

interface ReportDetailModalProps {
  report: ReportItem | null;
  onClose: () => void;
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
        <p className="text-[10px] uppercase tracking-[0.15em] text-sbi-muted mb-0.5">{label}</p>
        <p className="text-sm text-white truncate">{value}</p>
      </div>
    </div>
  );
}

export function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  if (!report) return null;

  const title = (
    <span className="flex items-center gap-3">
      <span className="truncate text-white normal-case tracking-normal">{report.title}</span>
      <StatusPill status={report.status} />
      <span className="text-xs text-sbi-muted tabular-nums normal-case tracking-normal">
        #{report.numid}
      </span>
    </span>
  );

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
          <MetaRow icon={Folder} label="Project" value={report.project || "—"} />
          <MetaRow icon={Building} label="Department" value={report.department} />
          <MetaRow icon={User} label="Assigned Director" value={report.director} />
          <MetaRow icon={CalendarIcon} label="Submitted" value={formatDate(report.date)} />
          {report.updated_at && (
            <MetaRow icon={CalendarIcon} label="Last Updated" value={formatDateTime(report.updated_at)} />
          )}
        </aside>

        <main className="bg-sbi-dark p-6 flex flex-col gap-6 min-w-0">
          <section>
            <h3 className="text-xs uppercase tracking-[0.15em] text-sbi-muted mb-3">Summary</h3>
            {report.message ? (
              <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{report.message}</p>
            ) : (
              <p className="text-sm text-sbi-muted italic">No summary provided by the director.</p>
            )}
          </section>

          {report.attachments && Array.isArray(report.attachments) && report.attachments.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-[0.15em] text-sbi-muted mb-3">Attachments</h3>
              <ul className="flex flex-col gap-2">
                {(report.attachments as Array<{ name?: string; path?: string; size?: string }>).map((a, i) => (
                  <li
                    key={a.path ?? i}
                    className="flex items-center gap-3 rounded-lg border border-sbi-dark-border/40 bg-sbi-dark-card/40 px-3 py-2.5 text-sm"
                  >
                    <FileText className="h-4 w-4 text-sbi-muted shrink-0" />
                    <span className="text-white/90 flex-1 truncate">{a.name ?? a.path ?? "Untitled"}</span>
                    {a.size && <span className="text-xs text-sbi-muted tabular-nums">{a.size}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>
    </Modal>
  );
}
