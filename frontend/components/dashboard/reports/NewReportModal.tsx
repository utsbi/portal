"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import { FileUpload } from "@/components/dashboard/requests/FileUpload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS } from "@/lib/departments";

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

async function uploadFiles(
  projectId: number,
  files: File[],
): Promise<Attachment[]> {
  if (files.length === 0) return [];
  const supabase = createClient();
  const uploads: Attachment[] = [];
  for (const file of files) {
    // Scope the object path by project id (first path segment) so the
    // ticket-attachments INSERT policy can enforce is_project_member on it.
    // The same path is persisted into tickets.attachments[].path, keeping
    // the read-side policy (which keys off that stored path) consistent.
    const path = `${projectId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });
    if (error)
      throw new Error(`Failed to upload ${file.name}: ${error.message}`);
    uploads.push({ path, name: file.name, size: humanSize(file.size) });
  }
  return uploads;
}

const departmentOptions = DEPARTMENTS;

const labelClass =
  "text-xs uppercase tracking-[0.1em] text-sbi-muted mb-2 font-medium";

const fieldClass =
  "bg-sbi-dark border-sbi-dark-border rounded-lg px-4 py-3 h-auto text-base md:text-base text-white placeholder:text-white/30 focus-visible:border-sbi-green/50 focus-visible:ring-sbi-green/20 focus-visible:ring-[2px] shadow-none";

function RequiredAsterisk() {
  return (
    <span className="text-red-400 ml-1" aria-hidden="true">
      *
    </span>
  );
}

export function NewReportModal({
  open,
  onClose,
  onCreated,
}: NewReportModalProps) {
  const { activeProject, user } = useProject();
  const defaultDept =
    departmentOptions.find((d) => d.value === user?.department)?.value ??
    departmentOptions[0]?.value ??
    "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [department, setDepartment] = useState(defaultDept);
  const [files, setFiles] = useState<File[]>([]);
  const [fileResetKey, setFileResetKey] = useState(0);

  useEffect(() => {
    if (open) {
      setDepartment(defaultDept);
    }
  }, [open, defaultDept]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const projectId = activeProject?.projectId;
    if (files.length > 0 && projectId == null) {
      toastError(
        "Select a project before attaching files to a report.",
        "No active project",
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const attachments =
        projectId != null ? await uploadFiles(projectId, files) : [];

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
        toastError(
          errBody?.error ?? "Couldn't submit the report. Please try again.",
          "Submission failed",
        );
      }
    } catch (err) {
      toastError(
        err instanceof Error ? err.message : "Couldn't submit the report.",
        "Submission failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title="Create New Report"
      size="lg"
      padded={false}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <Label htmlFor="report-subject" className={labelClass}>
            Subject
            <RequiredAsterisk />
          </Label>
          <Input
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
          <Label htmlFor="report-message" className={labelClass}>
            Message
            <RequiredAsterisk />
          </Label>
          <Textarea
            id="report-message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting}
            rows={5}
            className={`${fieldClass} resize-none min-h-[120px]`}
            placeholder="Summarize the status, results, or context the client should know about this project."
          />
        </div>

        <div>
          <span className={`block ${labelClass}`}>Attachments</span>
          <FileUpload key={fileResetKey} onFilesChange={setFiles} />
        </div>

        <div className="text-sm text-sbi-muted">
          <DropdownMenu>
            <DropdownMenuTrigger
              type="button"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none disabled:opacity-50"
            >
              Reporting on behalf of{" "}
              <span className="text-white">
                {departmentOptions.find((o) => o.value === department)?.label ??
                  department}
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={8}
              className="bg-sbi-dark border-sbi-dark-border max-h-72 custom-scrollbar"
            >
              <DropdownMenuRadioGroup
                value={department}
                onValueChange={setDepartment}
              >
                {departmentOptions.map((o) => (
                  <DropdownMenuRadioItem
                    key={o.value}
                    value={o.value}
                    className="pl-3 [&>span:first-child]:hidden text-sm text-white focus:bg-sbi-green/10 focus:text-sbi-green data-[state=checked]:text-sbi-green data-[state=checked]:bg-sbi-green/5"
                  >
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
