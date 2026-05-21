"use client";

import { AnimatePresence, motion } from "motion/react";
import { Building, Calendar as CalendarIcon, FileText, Folder, User, X } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { StatusPill } from "@/components/data-table";

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
  return (
    <AnimatePresence>
      {report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-sbi-dark/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-4xl max-h-[85vh] bg-sbi-dark flex flex-col z-10 border border-sbi-dark-border/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/40"
          >
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-sbi-dark-border/40">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <h2 className="text-lg md:text-xl font-light tracking-tight text-white truncate">
                    {report.title}
                  </h2>
                  <StatusPill status={report.status} />
                </div>
                <p className="text-xs text-sbi-muted tabular-nums">Report #{report.numid}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-2 text-sbi-muted hover:text-white rounded-md hover:bg-sbi-dark-card/60 transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid md:grid-cols-[280px_1fr] gap-0 md:gap-px bg-sbi-dark-border/30">
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
            </div>

            <div className="flex items-center justify-end px-6 py-4 border-t border-sbi-dark-border/40">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-sbi-dark-border/50 px-4 py-2 text-xs font-medium uppercase tracking-[0.04em] text-sbi-muted hover:text-white hover:border-sbi-dark-border transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
