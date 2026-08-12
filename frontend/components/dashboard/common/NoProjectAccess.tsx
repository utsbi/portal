"use client";

import { FolderKanban, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { btnGhost, DashboardShell, EmptyState, PageHeader } from "./ui";

/** Full-route guard for authenticated people who have no project membership. */
export function NoProjectAccess() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <DashboardShell>
      <PageHeader title="Project access" />
      <div className="flex flex-1 items-center">
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="No project access yet"
          description="Ask a director for access to a project."
          action={
            <button type="button" onClick={handleLogout} className={btnGhost}>
              <LogOut className="size-4" /> Log out
            </button>
          }
          className="w-full"
        />
      </div>
    </DashboardShell>
  );
}
