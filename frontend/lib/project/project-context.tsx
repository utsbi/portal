'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ProjectData {
  projectId: number;
  projectSlug: string;
  companyName: string;
  role: 'owner' | 'director' | 'member';
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: 'client' | 'director' | 'member';
  initials: string;
  department: string | null;
}

interface ProjectContextType {
  user: UserProfile | null;
  activeProject: ProjectData | null;
  projects: ProjectData[];
  isLoading: boolean;
  error: string | null;
  switchProject: (projectId: number) => void;
  refetch: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const ACTIVE_PROJECT_COOKIE = 'active_project_id';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || '??';
}

function getActiveProjectId(): number | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`${ACTIVE_PROJECT_COOKIE}=(\\d+)`));
  return match ? parseInt(match[1], 10) : null;
}

function setActiveProjectId(projectId: number) {
  document.cookie = `${ACTIVE_PROJECT_COOKIE}=${projectId};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

interface ProjectProviderProps {
  children: ReactNode;
  initialUser?: UserProfile | null;
  initialProjects?: ProjectData[] | null;
  initialActiveProjectId?: number | null;
}

export function ProjectProvider({
  children,
  initialUser,
  initialProjects,
  initialActiveProjectId,
}: ProjectProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser || null);
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects || []);
  const [activeProjectId, setActiveProjectIdState] = useState<number | null>(
    initialActiveProjectId || getActiveProjectId()
  );
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [error, setError] = useState<string | null>(null);

  const activeProject = projects.find(p => p.projectId === activeProjectId) || projects[0] || null;

  const switchProject = (projectId: number) => {
    setActiveProjectIdState(projectId);
    setActiveProjectId(projectId);
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email, role, department')
        .eq('uid', authUser.id)
        .single();

      if (!profile) {
        setError('Profile not found');
        setIsLoading(false);
        return;
      }

      setUser({
        id: profile.id,
        name: profile.name,
        email: profile.email || authUser.email || '',
        role: profile.role as UserProfile['role'],
        initials: getInitials(profile.name),
        department: profile.department ?? null,
      });

      // Fetch projects via project_members
      const { data: memberships } = await supabase
        .from('project_members')
        .select('role, project_id, projects(id, url_slug, company_name)')
        .eq('profile_id', profile.id);

      if (memberships && memberships.length > 0) {
        const projectList: ProjectData[] = memberships
          .filter((m: any) => m.projects)
          .map((m: any) => ({
            projectId: m.projects.id,
            projectSlug: m.projects.url_slug,
            companyName: m.projects.company_name,
            role: m.role as ProjectData['role'],
          }));

        setProjects(projectList);

        // Set active project from cookie or default to first
        const savedId = getActiveProjectId();
        const validSaved = projectList.find(p => p.projectId === savedId);
        if (validSaved) {
          setActiveProjectIdState(savedId);
        } else if (projectList.length > 0) {
          setActiveProjectIdState(projectList[0].projectId);
          setActiveProjectId(projectList[0].projectId);
        }
      }
    } catch (err) {
      setError('Failed to fetch project data');
      console.error('Project data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialUser) {
      fetchData();
    }
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        user,
        activeProject,
        projects,
        isLoading,
        error,
        switchProject,
        refetch: fetchData,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

/**
 * Convenience hook — returns activeProject or throws.
 * Use in pages that require a project to be selected.
 */
export function useRequiredProject() {
  const { activeProject, isLoading } = useProject();
  if (!isLoading && !activeProject) {
    throw new Error('No active project selected');
  }
  return activeProject;
}
