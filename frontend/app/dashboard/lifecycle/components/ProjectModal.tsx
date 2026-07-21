"use client";

import { FolderPlus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, Modal } from "@/components/dashboard/common/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/lib/notifications";
import { createLifecycleProject, updateLifecycleProject } from "../api";
import type { Project } from "../types";

const labelClass =
  "text-xs uppercase tracking-[0.1em] text-sbi-muted mb-2 font-medium";
const fieldClass =
  "bg-sbi-dark border-sbi-dark-border rounded-lg px-4 py-3 h-auto text-base text-white placeholder:text-white/30 focus-visible:border-sbi-green/50 focus-visible:ring-sbi-green/20 focus-visible:ring-[2px] shadow-none";

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  /** Parent project to attach a NEW lifecycle project to. */
  parentProjectId: number | null | undefined;
  /** When provided, the modal edits this project instead of creating one. */
  project?: Project | null;
  onSaved: () => void | Promise<void>;
}

export function ProjectModal({
  open,
  onClose,
  parentProjectId,
  project,
  onSaved,
}: ProjectModalProps) {
  const isEdit = !!project;
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(project?.title ?? "");
    setImage(project?.image ?? "");
    setCompleted(project?.completed ?? false);
  }, [open, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    let ok: boolean;
    if (isEdit && project) {
      ok = await updateLifecycleProject(project.id, {
        title: title.trim(),
        image: image.trim() || null,
        completed,
      });
    } else {
      if (!parentProjectId) {
        setSubmitting(false);
        toastError("No active project to attach this to.");
        return;
      }
      const created = await createLifecycleProject({
        parentProjectId,
        title: title.trim(),
        image: image.trim() || null,
      });
      ok = !!created;
    }
    setSubmitting(false);
    if (!ok) {
      toastError(`Couldn't ${isEdit ? "save" : "create"} the project.`);
      return;
    }
    toastSuccess(
      isEdit
        ? `Project "${title.trim()}" updated.`
        : `Project "${title.trim()}" created.`,
    );
    await onSaved();
    onClose();
  };

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={isEdit ? "Edit Project" : "Create Lifecycle Project"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="lp-title" className={labelClass}>
            Title
            <span className="ml-1 text-red-400" aria-hidden>
              *
            </span>
          </Label>
          <Input
            id="lp-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            className={fieldClass}
            placeholder="e.g. Campus Solar Initiative"
          />
        </div>

        <div>
          <Label htmlFor="lp-image" className={labelClass}>
            Cover image URL (optional)
          </Label>
          <Input
            id="lp-image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            disabled={submitting}
            className={fieldClass}
            placeholder="https://…"
          />
        </div>

        {isEdit ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/85">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              disabled={submitting}
              className="h-4 w-4 rounded border-sbi-dark-border bg-sbi-dark text-sbi-green focus:ring-sbi-green/40"
            />
            Mark project as complete
          </label>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-sbi-dark-border pt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={btnGhost}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className={btnPrimary}
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving…
              </>
            ) : isEdit ? (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            ) : (
              <>
                <FolderPlus className="h-4 w-4" />
                Create Project
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
