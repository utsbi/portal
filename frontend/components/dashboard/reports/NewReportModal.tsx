"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, FileText, X } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { toastError, toastSuccess } from "@/lib/notifications";
import { btnPrimary } from "@/components/dashboard/common/ui";
import { FileUpload } from "@/components/dashboard/requests/FileUpload";
import { DEPT_FILTER } from "./constants";

const BUCKET = "ticket-attachments";

interface NewReportModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (report: ReportItem) => void;
}

type Attachment = { path: string; name: string; size: string };

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function uploadFiles(files: File[]): Promise<Attachment[]> {
  if (files.length === 0) return [];
  const supabase = createClient();
  const uploads: Attachment[] = [];
  for (const file of files) {
    const path = `reports/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) throw new Error(`Failed to upload ${file.name}: ${error.message}`);
    uploads.push({ path, name: file.name, size: humanSize(file.size) });
  }
  return uploads;
}

export function NewReportModal({ open, onClose, onCreated }: NewReportModalProps) {
  const { activeProject, user } = useProject();
  const defaultDept = user?.department ?? "Engineering General";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeptOverride, setShowDeptOverride] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [department, setDepartment] = useState(defaultDept);
  const [files, setFiles] = useState<File[]>([]);
  const [fileResetKey, setFileResetKey] = useState(0);

  useEffect(() => {
    if (open) {
      setDepartment(defaultDept);
      setShowDeptOverride(false);
    }
  }, [open, defaultDept]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const attachments = await uploadFiles(files);

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          department,
          project_id: activeProject?.projectId ?? null,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (res.ok) {
        const newReport: ReportItem = await res.json();
        onCreated(newReport);
        onClose();
        setTitle("");
        setMessage("");
        setDepartment(defaultDept);
        setFiles([]);
        setFileResetKey((k) => k + 1);
        toastSuccess(`Report "${newReport.title ?? "Untitled"}" submitted.`);
      } else {
        const errBody = await res.json().catch(() => null);
        toastError(errBody?.error ?? "Couldn't submit the report. Please try again.", "Submission failed");
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Couldn't submit the report.", "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isSubmitting && onClose()}
          className="absolute inset-0 bg-sbi-dark/85 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-sbi-dark shadow-2xl flex flex-col z-10 border border-sbi-dark-border rounded-xl overflow-hidden font-urbanist"
        >
          <div className="flex items-center justify-between p-6 border-b border-sbi-dark-border bg-sbi-dark">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <FileText className="w-5 h-5 text-sbi-green" /> Create New Report
            </h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 text-sbi-muted hover:text-white rounded-full hover:bg-sbi-dark-card transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-sbi-dark-card">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2">
                Subject *
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm"
                placeholder="Quarterly Energy Modeling Review"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2">
                Message *
              </label>
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                rows={5}
                className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm resize-none"
                placeholder="Summarize the status, results, or context the client should know about this project."
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2">
                Attachments
              </label>
              <FileUpload key={fileResetKey} onFilesChange={setFiles} />
            </div>

            <div className="text-xs text-sbi-muted">
              {showDeptOverride ? (
                <div className="flex items-center gap-3">
                  <span className="uppercase tracking-[0.15em] text-sbi-muted-dark">Reporting on behalf of</span>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    disabled={isSubmitting}
                    className="bg-sbi-dark border border-sbi-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-sbi-green/50"
                  >
                    {DEPT_FILTER.options
                      ?.flatMap((opt) => {
                        if ("options" in opt && opt.options) return opt.options;
                        if (opt.value === "All Depts") return [];
                        return [opt];
                      })
                      .map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeptOverride(true)}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  Reporting on behalf of <span className="text-white">{department}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="border-t border-sbi-dark-border pt-6 flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-medium text-sbi-muted hover:text-white hover:bg-sbi-dark rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${btnPrimary} disabled:shadow-none flex items-center gap-2`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Report"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
