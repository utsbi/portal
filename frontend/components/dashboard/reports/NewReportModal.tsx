"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileText, X } from "lucide-react";
import type { ReportItem } from "@/app/api/reports/route";
import { useProject } from "@/lib/project/project-context";
import { createClient } from "@/lib/supabase/client";
import { toastError, toastSuccess } from "@/lib/notifications";
import { btnPrimary } from "@/components/dashboard/common/ui";
import { DEPT_FILTER } from "./constants";

interface Director {
  id: number;
  name: string;
  department: string | null;
}

interface NewReportModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (report: ReportItem) => void;
  knownProjects: string[];
}

export function NewReportModal({ open, onClose, onCreated, knownProjects }: NewReportModalProps) {
  const { activeProject } = useProject();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomProject, setIsCustomProject] = useState(false);
  const [form, setForm] = useState({
    title: "",
    department: "Engineering General",
    director: "",
    project: "",
    message: "",
  });
  const [directors, setDirectors] = useState<Director[]>([]);

  useEffect(() => {
    if (!open || directors.length > 0) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, name, department")
      .eq("role", "director")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setDirectors(data as Director[]);
      });
  }, [open, directors.length]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, project_id: activeProject?.projectId ?? null }),
      });
      if (res.ok) {
        const newReport: ReportItem = await res.json();
        onCreated(newReport);
        onClose();
        setForm({ title: "", department: "Engineering General", director: "", project: "", message: "" });
        toastSuccess(`Report "${newReport.title ?? "Untitled"}" submitted.`);
      } else {
        const errBody = await res.json().catch(() => null);
        toastError(errBody?.error ?? "Couldn't submit the report. Please try again.", "Submission failed");
      }
    } catch {
      toastError("Couldn't reach the server. Check your connection.", "Submission failed");
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
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2">
                  Subject / Title *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm"
                  placeholder="Quarterly Earnings Review"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2">
                    Department *
                  </label>
                  <select
                    required
                    value={form.department}
                    onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors text-sm appearance-none"
                  >
                    {DEPT_FILTER.options?.map((opt) => {
                      if ("options" in opt && opt.options) {
                        return opt.options.map((sub) => (
                          <option key={sub.value} value={sub.value}>
                            {sub.label}
                          </option>
                        ));
                      }
                      if (opt.value === "All Depts") return null;
                      return (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2">
                    Assigned Director *
                  </label>
                  <select
                    required
                    value={form.director}
                    onChange={(e) => setForm((p) => ({ ...p, director: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors text-sm appearance-none"
                  >
                    <option value="" disabled>
                      Select a director…
                    </option>
                    {directors.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.department ? `${d.name}, ${d.department}` : d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold">
                    Project ID / Reference
                  </label>
                  {isCustomProject && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomProject(false);
                        setForm((p) => ({ ...p, project: "" }));
                      }}
                      className="text-[10px] text-sbi-green hover:underline"
                    >
                      Select Existing
                    </button>
                  )}
                </div>
                {isCustomProject ? (
                  <input
                    required
                    value={form.project}
                    onChange={(e) => setForm((p) => ({ ...p, project: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm font-mono"
                    placeholder="Enter new Project ID..."
                    autoFocus
                  />
                ) : (
                  <select
                    required
                    value={form.project}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setIsCustomProject(true);
                        setForm((p) => ({ ...p, project: "" }));
                      } else {
                        setForm((p) => ({ ...p, project: e.target.value }));
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors text-sm appearance-none font-mono"
                  >
                    <option value="" disabled>
                      Select an existing project...
                    </option>
                    <option value="__NEW__" className="text-sbi-green font-bold bg-sbi-dark-card">
                      + Enter New Project ID
                    </option>
                    {knownProjects.slice(0, 10).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.15em] text-sbi-muted-dark font-bold mb-2">
                  Report Message / Notes
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                  disabled={isSubmitting}
                  rows={4}
                  className="w-full bg-sbi-dark border border-sbi-dark-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-white/20 text-sm resize-none"
                  placeholder="Include any preliminary context regarding this record..."
                />
              </div>
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
                    Transmitting...
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
