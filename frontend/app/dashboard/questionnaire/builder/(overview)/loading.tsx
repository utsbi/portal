import {
  DashboardMain,
  DashboardShell,
  PageHeader,
} from "@/components/dashboard/common/ui";

export default function BuilderLoading() {
  return (
    <DashboardShell>
      <PageHeader
        title="Form Builder"
        subtitle="Create customizable questionnaires for your clients"
        action={
          <div className="flex items-center gap-2" aria-hidden>
            <div className="h-9 w-28 rounded-md bg-white/5" />
            <div className="h-9 w-24 rounded-md bg-white/5" />
          </div>
        }
      />

      <DashboardMain>
        <output
          className="flex min-h-72 flex-col items-center justify-center text-center animate-pulse"
          aria-label="Loading forms"
        >
          <div className="size-14 rounded-full border border-sbi-green/20 bg-sbi-green/5" />
          <div className="mt-6 h-5 w-28 rounded bg-white/5" />
          <div className="mt-3 h-3 w-72 max-w-[80vw] rounded bg-white/5" />
          <div className="mt-7 h-10 w-52 rounded-md bg-sbi-green/10" />
        </output>
      </DashboardMain>
    </DashboardShell>
  );
}
