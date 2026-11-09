import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/dashboard/common/AdminNavigation";
import {
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
    <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-sbi-dark dashboard-scrollbar">
      <div className="mx-auto w-full max-w-7xl p-4 pb-10 sm:p-6 sm:pb-10 md:p-8 md:pb-10">
        <PageHeader
          title="Admin"
          subtitle="Organization-wide reporting and administration."
        />
        {gate.ok ? (
          <>
            <AdminNavigation />
            {children}
          </>
        ) : (
          <Panel>
            <EmptyState
              icon={<ShieldCheck className="size-6" />}
              title="Admin access required"
              description="Only directors and the president can access this workspace."
            />
          </Panel>
        )}
      </div>
    </main>
  );
}
