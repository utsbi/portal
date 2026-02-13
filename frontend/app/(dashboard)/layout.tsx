import { AppSidebar } from "@/components/dashboard/common/app-sidebar";
import { SidebarTriggerCustom } from "@/components/dashboard/common/SidebarTriggerCustom";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 bg-sbi-dark border-b border-sbi-dark-border/30 px-4">
            <SidebarTriggerCustom />
          </header>
          <div className="flex flex-1 flex-col bg-sbi-dark">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
