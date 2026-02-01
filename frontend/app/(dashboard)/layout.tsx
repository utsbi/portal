import { AppSidebar } from "@/components/dashboard/common/app-sidebar";
import { ProjectStatusBar } from "@/components/dashboard/common/ProjectStatusBar";
import { SidebarTriggerCustom } from "@/components/dashboard/common/SidebarTriggerCustom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-urbanist bg-sbi-dark min-h-screen">
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset className="bg-sbi-dark">
          {/* Header*/}
          <header className="relative flex h-16 shrink-0 items-center gap-2 bg-sbi-dark px-6 border-b border-sbi-dark-border/30">
            <div className="absolute left-0 top-0 w-16 h-full border-r border-sbi-dark-border/20" />

            {/* Sidebar */}
            <div className="relative z-10">
              <SidebarTriggerCustom />
            </div>

            <ProjectStatusBar />

            <div className="flex-1" />

            {/* Right side status indicator */}
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-sbi-green/60 rounded-full animate-pulse" />
              <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-muted-dark font-light">
                Online
              </span>
            </div>
          </header>

          {/* Main content */}
          <div className="flex flex-1 flex-col bg-sbi-dark relative">
            <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-sbi-dark-card/20 to-transparent pointer-events-none" />
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
