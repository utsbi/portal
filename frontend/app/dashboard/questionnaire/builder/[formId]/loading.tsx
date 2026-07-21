import {
  DashboardMain,
  DashboardShell,
  PageHeader,
  Panel,
} from "@/components/dashboard/common/ui";

const FIELD_SKELETONS = Array.from(
  { length: 3 },
  (_, i) => `field-skeleton-${i}`,
);

export default function FormBuilderLoading() {
  return (
    <DashboardShell>
      <PageHeader
        title="Edit Form"
        subtitle="Loading…"
        action={
          <div className="flex flex-wrap items-center gap-2 animate-pulse">
            <div className="h-9 w-[7.5rem] rounded-md bg-white/5" />
            <div className="h-9 w-[5.5rem] rounded-md bg-white/5" />
            <div className="h-9 w-14 rounded-md bg-white/5" />
            <div className="h-9 w-14 rounded-md bg-white/5" />
            <div className="h-9 w-[4.5rem] rounded-md bg-white/5" />
          </div>
        }
      />

      <DashboardMain className="pb-10">
        <div className="flex flex-col gap-6 max-w-3xl animate-pulse">
          {/* Meta: title + description */}
          <Panel className="flex flex-col gap-4">
            <div>
              <div className="h-3 w-20 rounded bg-white/5 mb-2" />
              <div className="h-10 w-full rounded-md bg-white/5" />
            </div>
            <div>
              <div className="h-3 w-24 rounded bg-white/5 mb-2" />
              <div className="h-16 w-full rounded-md bg-white/5" />
            </div>
          </Panel>

          {/* Assignment chips */}
          <Panel className="flex flex-col gap-3">
            <div className="h-3 w-32 rounded bg-white/5" />
            <div className="flex flex-wrap gap-2">
              <div className="h-9 w-28 rounded-md bg-white/5" />
              <div className="h-9 w-36 rounded-md bg-white/5" />
              <div className="h-9 w-24 rounded-md bg-white/5" />
            </div>
          </Panel>

          {/* Sharing panel */}
          <Panel className="flex flex-col gap-3">
            <div className="h-3 w-28 rounded bg-white/5" />
            <div className="flex gap-2">
              <div className="h-9 w-24 rounded-md bg-white/5" />
              <div className="h-9 w-24 rounded-md bg-white/5" />
              <div className="h-9 w-24 rounded-md bg-white/5" />
            </div>
          </Panel>

          {/* Question fields */}
          <div className="flex flex-col gap-3">
            <div className="h-3 w-20 rounded bg-white/5" />
            {FIELD_SKELETONS.map((key) => (
              <Panel key={key} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-5 rounded bg-white/5" />
                  <div className="h-4 flex-1 rounded bg-white/5" />
                  <div className="h-8 w-24 rounded-md bg-white/5" />
                </div>
                <div className="h-10 w-full rounded-md bg-white/5" />
              </Panel>
            ))}
          </div>
        </div>
      </DashboardMain>
    </DashboardShell>
  );
}
