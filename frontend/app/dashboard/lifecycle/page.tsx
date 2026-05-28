"use client";

import { FolderKanban } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import {
  DashboardShell,
  EmptyState,
  PageHeader,
  SectionLabel,
} from "@/components/dashboard/common/ui";
import { useProject } from "@/lib/project/project-context";
import ProjectCard from "./components/ProjectCard";
import { ProjectHeroCard } from "./components/ProjectHeroCard";
import type { Project } from "./types";
import { useLifecycleProjects } from "./use-lifecycle";

function latestUpdate(p: Project): number {
  return p.tasks.reduce((max, t) => Math.max(max, t.updated_at.getTime()), 0);
}

/** Hero = the project most worth attention; rest sorted active-first,
 * completed faded to the end. */
function arrange(projects: Project[]): {
  hero: Project | null;
  rest: Project[];
} {
  if (projects.length === 0) return { hero: null, rest: [] };
  const active = projects.filter(
    (p) => !p.completed && p.progress_percent < 100,
  );
  const done = projects.filter((p) => p.completed || p.progress_percent >= 100);

  const heroPool = active.length > 0 ? active : done;
  const hero = [...heroPool].sort((a, b) => {
    if (active.length > 0) return b.progress_percent - a.progress_percent;
    return latestUpdate(b) - latestUpdate(a);
  })[0];

  const rest = [
    ...active
      .filter((p) => p.id !== hero.id)
      .sort((a, b) => b.progress_percent - a.progress_percent),
    ...done
      .filter((p) => p.id !== hero.id)
      .sort((a, b) => latestUpdate(b) - latestUpdate(a)),
  ];
  return { hero, rest };
}

function LifecyclePageInner() {
  const { activeProject } = useProject();
  const searchParams = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";

  const { projects, loading } = useLifecycleProjects({
    parentProjectId: activeProject?.projectId,
    demoMode,
  });

  const { hero, rest } = useMemo(() => arrange(projects), [projects]);

  return (
    <DashboardShell>
      <PageHeader
        title="Lifecycle"
        subtitle="Track progress across your active projects"
      />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && projects.length === 0 ? (
          <div className="animate-pulse space-y-6">
            <div className="h-40 rounded-2xl bg-white/5" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {["a", "b", "c"].map((k) => (
                <div key={k} className="h-56 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-6 w-6" />}
            title="No projects yet"
            description="New lifecycle projects will appear here as your team kicks them off."
          />
        ) : (
          <div className="flex flex-col gap-8 pb-2">
            {hero ? (
              <div>
                <SectionLabel>Current Focus</SectionLabel>
                <ProjectHeroCard project={hero} />
              </div>
            ) : null}

            {rest.length > 0 ? (
              <div>
                <SectionLabel>{`All Projects · ${projects.length}`}</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rest.map((p, i) => (
                    <ProjectCard key={p.id} project={p} index={i} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}

export default function LifecyclePage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <PageHeader
            title="Lifecycle"
            subtitle="Track progress across your active projects"
          />
          <div className="flex-1" />
        </DashboardShell>
      }
    >
      <LifecyclePageInner />
    </Suspense>
  );
}
