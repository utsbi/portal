"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProjectById, fetchProjects, updateTaskStatus } from "./api";
import { getProjectById, MOCK_PROJECTS } from "./mockData";
import type { Project, TaskStatusDB } from "./types";

function recomputeProgress(project: Project): number {
  if (project.tasks.length === 0) return 0;
  const done = project.tasks.filter((t) => t.status === "completed").length;
  return Math.round((done / project.tasks.length) * 100);
}

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
}

export function useLifecycleProjects({
  parentProjectId,
  demoMode,
}: {
  parentProjectId: number | null | undefined;
  demoMode: boolean;
}): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (demoMode) {
      setProjects(MOCK_PROJECTS);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await fetchProjects(parentProjectId);
      setProjects(data);
    } catch (e) {
      console.error("Failed to load lifecycle projects:", e);
      setError(true);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [parentProjectId, demoMode]);

  useEffect(() => {
    load();
  }, [load]);

  return { projects, loading, error, refetch: load };
}

interface ProjectState {
  project: Project | null;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
  /** Director-only optimistic status change. Returns success. */
  setTaskStatus: (taskId: number, status: TaskStatusDB) => Promise<boolean>;
}

export function useLifecycleProject({
  projectId,
  demoMode,
}: {
  projectId: number;
  demoMode: boolean;
}): ProjectState {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    if (demoMode) {
      setProject(getProjectById(projectId) ?? null);
      setLoading(false);
      setError(false);
      hasLoaded.current = true;
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await fetchProjectById(projectId);
      setProject(data);
      hasLoaded.current = true;
    } catch (e) {
      console.error("Failed to load lifecycle project:", e);
      setError(true);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, demoMode]);

  useEffect(() => {
    load();
  }, [load]);

  const setTaskStatus = useCallback(
    async (taskId: number, status: TaskStatusDB) => {
      let previous: TaskStatusDB | undefined;
      setProject((curr) => {
        if (!curr) return curr;
        const tasks = curr.tasks.map((t) => {
          if (t.id !== taskId) return t;
          previous = t.status;
          return { ...t, status, updated_at: new Date() };
        });
        const next = { ...curr, tasks };
        return { ...next, progress_percent: recomputeProgress(next) };
      });

      if (demoMode) return true;

      const ok = await updateTaskStatus(taskId, status);
      if (!ok && previous !== undefined) {
        const reverted = previous;
        setProject((curr) => {
          if (!curr) return curr;
          const tasks = curr.tasks.map((t) =>
            t.id === taskId ? { ...t, status: reverted } : t,
          );
          const next = { ...curr, tasks };
          return { ...next, progress_percent: recomputeProgress(next) };
        });
      }
      return ok;
    },
    [demoMode],
  );

  return { project, loading, error, refetch: load, setTaskStatus };
}
