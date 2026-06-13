import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/common/app-sidebar";
import { ProjectStatusBar } from "@/components/dashboard/common/ProjectStatusBar";
import { ProjectSwitchOverlay } from "@/components/dashboard/common/ProjectSwitchOverlay";
import { SidebarTriggerCustom } from "@/components/dashboard/common/SidebarTriggerCustom";
import { TimeDisplay } from "@/components/dashboard/explore/ui/TimeDisplay";
import { ChatProvider } from "@/lib/chat/chat-context";
import { ProjectProvider } from "@/lib/project/project-context";
import { resolveActor } from "@/lib/project/resolve-actor";
import { SIDEBAR_COOKIE } from "@/lib/sidebar/cookie";
import { SidebarProvider } from "@/lib/sidebar/sidebar-context";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const actor = await resolveActor();

  if (!actor) {
    redirect("/login");
  }

  // Seed the sidebar's open state from the persisted cookie so the first render
  // matches the user's last choice (no collapsed->open shift on refresh).
  const sidebarOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value === "true";

  const activeProject =
    actor.projects.find((p) => p.projectId === actor.activeProjectId) ||
    actor.projects[0] ||
    null;

  return (
    <ProjectProvider
      initialUser={actor.profile}
      initialProjects={actor.projects}
      initialActiveProjectId={activeProject?.projectId ?? null}
    >
      <ChatProvider>
        <SidebarProvider defaultOpen={sidebarOpen}>
          <div className="font-urbanist bg-sbi-dark h-screen overflow-hidden flex">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <header className="relative flex h-16 shrink-0 items-center gap-2 bg-sbi-dark px-6 border-b border-sbi-dark-border/30">
                <div className="absolute left-0 top-0 w-16 h-full border-r border-sbi-dark-border/20" />

                {/* Sidebar */}
                <div className="relative z-10">
                  <SidebarTriggerCustom />
                </div>

                <ProjectStatusBar />

                <div className="flex-1" />

                <TimeDisplay />
              </header>

              {/* Main content */}
              <div className="flex flex-1 flex-col min-h-0 bg-sbi-dark relative">
                <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-sbi-dark-card/20 to-transparent pointer-events-none" />
                {children}
                <ProjectSwitchOverlay />
              </div>
            </div>
          </div>
        </SidebarProvider>
      </ChatProvider>
    </ProjectProvider>
  );
}
