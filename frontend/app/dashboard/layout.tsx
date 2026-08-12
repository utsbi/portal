import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/common/app-sidebar";
import { NoProjectAccess } from "@/components/dashboard/common/NoProjectAccess";
import { ProjectStatusBar } from "@/components/dashboard/common/ProjectStatusBar";
import { ProjectSwitcher } from "@/components/dashboard/common/ProjectSwitcher";
import { ProjectSwitchOverlay } from "@/components/dashboard/common/ProjectSwitchOverlay";
import { SidebarTriggerCustom } from "@/components/dashboard/common/SidebarTriggerCustom";
import { MobileNewChatButton } from "@/components/dashboard/explore/ui/MobileNewChatButton";
import { TimeDisplay } from "@/components/dashboard/explore/ui/TimeDisplay";
import { isStaffRole } from "@/lib/auth/roles";
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

  // An authenticated profile can legitimately exist before a director assigns
  // it to a project (for example after Discord verification).  Do this at the
  // layout boundary so deep links cannot render a feature with null project
  // state or expose its navigation. Directors retain the workspace so they can
  // create a project and set its default from Settings.
  const needsProjectAccessGuard =
    actor.projects.length === 0 && !isStaffRole(actor.profile.role);

  if (needsProjectAccessGuard) {
    return (
      <ProjectProvider
        initialUser={actor.profile}
        initialProjects={actor.projects}
        initialActiveProjectId={null}
      >
        <div className="font-urbanist h-screen overflow-hidden bg-sbi-dark">
          <NoProjectAccess />
        </div>
      </ProjectProvider>
    );
  }

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
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {/* Header */}
              <header className="relative flex h-16 shrink-0 items-center gap-2 bg-sbi-dark pr-4 md:pr-6 border-b border-sbi-dark-border/30">
                {/* Sidebar trigger — matching horizontal padding on both sides
                    so the right hairline mirrors the left inset (was an
                    absolute w-16 strip). Tighter below md to leave room for
                    the project switcher on phones. */}
                <div className="relative z-10 flex h-full items-center px-4 md:px-6 border-r border-sbi-dark-border/20">
                  <SidebarTriggerCustom />
                </div>

                {/* Active-project context (switcher for directors/members,
                    static label for clients) — always visible here regardless
                    of the sidebar's collapsed state. */}
                <ProjectSwitcher />

                <ProjectStatusBar />

                <div className="flex-1" />

                {/* Phone-only quick action: start a new Explore chat without
                    opening the sidebar. Renders nothing off the Explore routes
                    and at md+ (where the sidebar's own "New chat" is at hand). */}
                <MobileNewChatButton />

                {/* Clock/date readout is ambient info — hidden below md so the
                    trigger + project switcher keep the phone header uncluttered. */}
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
