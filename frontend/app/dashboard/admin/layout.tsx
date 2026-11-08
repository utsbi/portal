import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/dashboard/common/AdminNavigation";
import {
  DashboardMain,
  DashboardShell,
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/dashboard/common/ui";
import { requireDirector } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const gate = await requireDirector();

  return (
    <DashboardShell>
      <PageHeader
        title="Admin"
        subtitle="Organization-wide reporting and administration."
      />
      {gate.ok ? (
        <>
          <AdminNavigation />
          <DashboardMain contentClassName="pb-10">{children}</DashboardMain>
        </>
      ) : (
        <DashboardMain>
          <Panel>
            <EmptyState
              icon={<ShieldCheck className="size-6" />}
              title="Admin access required"
              description="Only directors and the president can access this workspace."
            />
          </Panel>
        </DashboardMain>
      )}
    </DashboardShell>
  );
}
