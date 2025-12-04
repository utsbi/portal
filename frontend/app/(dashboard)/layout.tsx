import { dm_sans } from '@/utils/fonts';
import { AppSidebar } from '@/components/dashboard/common/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={dm_sans.className}>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 bg-zinc-950 px-4">
            <SidebarTrigger className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50" />
          </header>
          <div className="flex flex-1 flex-col bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}