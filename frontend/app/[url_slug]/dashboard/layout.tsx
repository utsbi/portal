import { redirect, notFound } from "next/navigation";
import { AppSidebar } from "@/components/dashboard/common/app-sidebar";
import { ProjectStatusBar } from "@/components/dashboard/common/ProjectStatusBar";
import { SidebarTriggerCustom } from "@/components/dashboard/common/SidebarTriggerCustom";
import { TimeDisplay } from "@/components/dashboard/explore/ui/TimeDisplay";
import { createClient } from "@/lib/supabase/server";
import { ClientProvider } from "@/lib/client/client-context";
import { SidebarProvider } from "@/lib/sidebar/sidebar-context";
import { ChatProvider } from "@/lib/chat/chat-context";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ url_slug: string }>;
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { url_slug } = await params;
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify the user has access to this url_slug by checking the clients table
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, company_name, url_slug")
    .eq("uid", user.id)
    .eq("url_slug", url_slug)
    .single();

  if (!client) {
    notFound();
  }

  // Calculate initials for the user
  const displayName = client.name || client.company_name || user.email?.split('@')[0] || 'User';
  const nameParts = displayName.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : nameParts[0]?.substring(0, 2).toUpperCase() || '??';

  const initialClientData = {
    id: client.id,
    name: displayName,
    email: user.email || '',
    companyName: client.company_name,
    urlSlug: client.url_slug,
    initials,
  };

  return (
    <ClientProvider urlSlug={url_slug} initialClientData={initialClientData}>
      <ChatProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="font-urbanist bg-sbi-dark min-h-screen flex">
            <AppSidebar urlSlug={url_slug} />
            <div className="flex-1 flex flex-col min-h-screen">
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
              <div className="flex flex-1 flex-col bg-sbi-dark relative">
                <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-sbi-dark-card/20 to-transparent pointer-events-none" />
                {children}
              </div>
            </div>
          </div>
        </SidebarProvider>
      </ChatProvider>
    </ClientProvider>
  );
}
