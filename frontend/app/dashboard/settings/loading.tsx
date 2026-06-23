import { Loader2 } from "lucide-react";
import {
  DashboardShell,
  PageHeader,
  Panel,
} from "@/components/dashboard/common/ui";

export default function SettingsLoading() {
  return (
    <DashboardShell className="overflow-y-auto">
      <PageHeader title="Settings" subtitle="Loading…" />
      <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] gap-8 lg:gap-12 pb-8">
        <div className="h-40 rounded-md border border-sbi-dark-border/30 bg-sbi-dark-card/20" />
        <Panel>
          <div className="flex items-center gap-2 text-sbi-muted text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading settings…
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
