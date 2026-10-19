"use client";

import { FolderOpen, LibraryBig } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DashboardShell, PageHeader } from "@/components/dashboard/common/ui";
import { isStaffRole } from "@/lib/auth/roles";
import { useProject } from "@/lib/project/project-context";
import { cn } from "@/lib/utils";
import DepartmentLibrary from "./DepartmentLibrary";

export default function FilesWorkspace({ children }: { children: ReactNode }) {
  const { user } = useProject();
  const [view, setView] = useState<"project" | "library">("project");
  const canViewLibrary = user?.role === "member" || isStaffRole(user?.role);
  const showLibrary = canViewLibrary && view === "library";

  return (
    <DashboardShell>
      <PageHeader
        title="Files"
        subtitle={
          canViewLibrary
            ? "Browse and manage your files."
            : "Browse and download files shared on your project."
        }
      />

      {canViewLibrary && (
        <div className="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <fieldset
            aria-label="File location"
            className="inline-flex rounded-lg border border-sbi-dark-border/70 bg-sbi-dark-card/40 p-1"
          >
            {(
              [
                { id: "project", label: "Project files", icon: FolderOpen },
                { id: "library", label: "Department files", icon: LibraryBig },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const selected =
                item.id === "library" ? showLibrary : !showLibrary;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  aria-controls={`files-${item.id}-view`}
                  onClick={() => setView(item.id)}
                  className={cn(
                    "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sbi-green",
                    selected
                      ? "bg-white/[0.06] text-white"
                      : "text-sbi-muted hover:text-white",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </fieldset>
        </div>
      )}

      {/* Keep the project browser mounted: changing this local view must not
          interrupt an upload, reset the folder, or change the storage root. */}
      <section
        id="files-project-view"
        aria-label="Project files"
        hidden={showLibrary}
        className={cn(
          "min-h-0 flex-1 flex-col",
          showLibrary ? "hidden" : "flex",
        )}
      >
        {children}
      </section>
      {canViewLibrary && user && (
        <section
          id="files-library-view"
          aria-label="Department files"
          hidden={!showLibrary}
          className={cn(
            "min-h-0 flex-1 flex-col",
            showLibrary ? "flex" : "hidden",
          )}
        >
          <DepartmentLibrary
            key={`${user.role}:${user.department ?? ""}`}
            user={user}
          />
        </section>
      )}
    </DashboardShell>
  );
}
