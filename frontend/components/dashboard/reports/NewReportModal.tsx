"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { toastError, toastSuccess } from "@/lib/notifications";
import { Modal, btnGhost, btnPrimary } from "@/components/dashboard/common/ui";
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

const departmentOptions: { value: string; label: string }[] = [];
for (const opt of DEPT_FILTER.options ?? []) {
  if ("options" in opt && opt.options) {
    for (const sub of opt.options) departmentOptions.push(sub);
  } else if ("value" in opt && opt.value && opt.value !== "All Depts") {
    departmentOptions.push({ value: opt.value, label: opt.label });
  }
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

  const fieldLabel = "block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2";
  const fieldClass =
    "w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-sbi-green/50 placeholder:text-white/20 transition-colors";

  return (
    <Modal opened={open} onClose={onClose} title="Create New Report" size="lg" padded={false}>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label htmlFor="report-subject" className={fieldLabel}>
            Subject *
          </label>
          <input
            id="report-subject"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            className={fieldClass}
            placeholder="Quarterly Energy Modeling Review"
          />
        </div>

        <div>
          <label htmlFor="report-message" className={fieldLabel}>
            Message *
          </label>
          <textarea
            id="report-message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting}
            rows={5}
            className={`${fieldClass} resize-none`}
            placeholder="Summarize the status, results, or context the client should know about this project."
          />
        </div>

        <div>
          <span className={fieldLabel}>Attachments</span>
          <FileUpload key={fileResetKey} onFilesChange={setFiles} />
        </div>

        <div className="text-xs text-sbi-muted">
          {showDeptOverride ? (
            <div className="flex items-center gap-3">
              <label
                htmlFor="report-department"
                className="uppercase tracking-[0.15em] text-sbi-muted-dark"
              >
                Reporting on behalf of
              </label>
              <select
                id="report-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={isSubmitting}
                className="bg-sbi-dark border border-sbi-dark-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-sbi-green/50"
              >
                {departmentOptions.map((o) => (
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

        <div className="border-t border-sbi-dark-border pt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={btnGhost}
          >
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Report"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
