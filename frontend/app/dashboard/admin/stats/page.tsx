import {
  Activity,
  Bot,
  Database,
  FileStack,
  FolderKanban,
  HardDrive,
  MessageSquare,
  Users,
} from "lucide-react";
import {
  DashboardMain,
  DashboardShell,
  EmptyState,
  PageHeader,
  Panel,
  SectionLabel,
  StatTile,
} from "@/components/dashboard/common/ui";
import { requireDirector } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type Stats = {
  generated_at: string;
  profiles: {
    total: number;
    portal_accounts: number;
    by_role: Record<string, number>;
    member_profiles_without_account: number;
  };
  projects: {
    total: number;
    default_project_id: number | null;
    memberships: number;
  };
  activity: {
    chat_sessions: number;
    chat_messages: number;
    messages: number;
    files: number;
    knowledge_documents: number;
  };
  ai_usage: {
    requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
  ai_usage_by_user: Array<{
    profile_id: number;
    name: string;
    email: string | null;
    role: string;
    requests: number;
    prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    last_used_at: string | null;
  }>;
  storage: Array<{
    bucket_id: string;
    objects: number;
    bytes: number;
  }>;
};

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(value) || 0;
}

function parseStats(value: Json): Stats {
  // The RPC is internal and its shape is defined by the migration. Keep the
  // cast at this boundary so the rest of the page remains strongly typed.
  const raw = value as Partial<Stats>;
  const profiles = (raw.profiles ?? {}) as Partial<Stats["profiles"]>;
  const projects = (raw.projects ?? {}) as Partial<Stats["projects"]>;
  const activity = (raw.activity ?? {}) as Partial<Stats["activity"]>;
  const aiUsage = (raw.ai_usage ?? {}) as Partial<Stats["ai_usage"]>;

  return {
    generated_at: String(raw.generated_at ?? new Date().toISOString()),
    profiles: {
      total: asNumber(profiles.total),
      portal_accounts: asNumber(profiles.portal_accounts),
      by_role: profiles.by_role ?? {},
      member_profiles_without_account: asNumber(
        profiles.member_profiles_without_account,
      ),
    },
    projects: {
      total: asNumber(projects.total),
      default_project_id:
        typeof projects.default_project_id === "number"
          ? projects.default_project_id
          : null,
      memberships: asNumber(projects.memberships),
    },
    activity: {
      chat_sessions: asNumber(activity.chat_sessions),
      chat_messages: asNumber(activity.chat_messages),
      messages: asNumber(activity.messages),
      files: asNumber(activity.files),
      knowledge_documents: asNumber(activity.knowledge_documents),
    },
    ai_usage: {
      requests: asNumber(aiUsage.requests),
      prompt_tokens: asNumber(aiUsage.prompt_tokens),
      completion_tokens: asNumber(aiUsage.completion_tokens),
      reasoning_tokens: asNumber(aiUsage.reasoning_tokens),
      total_tokens: asNumber(aiUsage.total_tokens),
      estimated_cost_usd: asNumber(aiUsage.estimated_cost_usd),
    },
    ai_usage_by_user: Array.isArray(raw.ai_usage_by_user)
      ? (raw.ai_usage_by_user as Stats["ai_usage_by_user"])
      : [],
    storage: Array.isArray(raw.storage)
      ? (raw.storage as Stats["storage"])
      : [],
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminStatsPage() {
  const gate = await requireDirector();
  if (!gate.ok) {
    return (
      <DashboardShell>
        <PageHeader
          title="Admin stats"
          subtitle="Restricted workspace reporting"
        />
        <DashboardMain>
          <Panel>
            <EmptyState
              icon={<Database className="size-6" />}
              title="Admin access required"
              description={gate.error}
            />
          </Panel>
        </DashboardMain>
      </DashboardShell>
    );
  }

  const { data, error } = await createAdminClient().rpc("admin_stats");
  if (error || !data) {
    return (
      <DashboardShell>
        <PageHeader
          title="Admin stats"
          subtitle="Restricted workspace reporting"
        />
        <DashboardMain>
          <Panel>
            <EmptyState
              icon={<Database className="size-6" />}
              title="Stats are unavailable"
              description={
                error?.message ?? "The reporting snapshot could not be loaded."
              }
            />
          </Panel>
        </DashboardMain>
      </DashboardShell>
    );
  }

  const stats = parseStats(data);

  return (
    <DashboardShell>
      <PageHeader
        title="Admin stats"
        subtitle={`Workspace health and usage · updated ${formatDate(stats.generated_at)}`}
      />
      <DashboardMain contentClassName="space-y-8 pb-10">
        <section>
          <SectionLabel>Overview</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Portal accounts"
              value={formatNumber(stats.profiles.portal_accounts)}
              sublabel={`${formatNumber(stats.profiles.member_profiles_without_account)} member profiles awaiting invites`}
              icon={<Users className="size-4" />}
              tone="accent"
            />
            <StatTile
              label="Projects"
              value={formatNumber(stats.projects.total)}
              sublabel={`${formatNumber(stats.projects.memberships)} active memberships`}
              icon={<FolderKanban className="size-4" />}
            />
            <StatTile
              label="AI requests"
              value={formatNumber(stats.ai_usage.requests)}
              sublabel={`${formatNumber(stats.ai_usage.total_tokens)} total tokens`}
              icon={<Bot className="size-4" />}
              tone="accent"
            />
            <StatTile
              label="Estimated AI cost"
              value={formatCost(stats.ai_usage.estimated_cost_usd)}
              sublabel="Based on configured OpenRouter rates"
              icon={<Activity className="size-4" />}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <SectionLabel>AI usage</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Metric
                label="Prompt"
                value={formatNumber(stats.ai_usage.prompt_tokens)}
              />
              <Metric
                label="Completion"
                value={formatNumber(stats.ai_usage.completion_tokens)}
              />
              <Metric
                label="Reasoning"
                value={formatNumber(stats.ai_usage.reasoning_tokens)}
              />
              <Metric
                label="Total"
                value={formatNumber(stats.ai_usage.total_tokens)}
              />
            </div>
            <p className="mt-6 text-xs text-sbi-muted-dark">
              Reasoning tokens are included in completion usage by the model
              provider.
            </p>
          </Panel>

          <Panel>
            <SectionLabel>Workspace activity</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Metric
                label="Chat sessions"
                value={formatNumber(stats.activity.chat_sessions)}
              />
              <Metric
                label="Chat messages"
                value={formatNumber(stats.activity.chat_messages)}
              />
              <Metric
                label="Portal messages"
                value={formatNumber(stats.activity.messages)}
              />
              <Metric
                label="Files"
                value={formatNumber(stats.activity.files)}
              />
              <Metric
                label="Knowledge docs"
                value={formatNumber(stats.activity.knowledge_documents)}
              />
              <Metric
                label="Profiles"
                value={formatNumber(stats.profiles.total)}
              />
            </div>
          </Panel>
        </div>

        <Panel>
          <SectionLabel>Token usage by user</SectionLabel>
          {stats.ai_usage_by_user.length === 0 ? (
            <p className="text-sm text-sbi-muted">No recorded AI usage yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-sbi-dark-border/50 text-xs uppercase tracking-[0.14em] text-sbi-muted-dark">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">User</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 text-right font-medium">
                      Requests
                    </th>
                    <th className="pb-3 pr-4 text-right font-medium">Tokens</th>
                    <th className="pb-3 pr-4 text-right font-medium">Cost</th>
                    <th className="pb-3 text-right font-medium">Last used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sbi-dark-border/30">
                  {stats.ai_usage_by_user.map((user) => (
                    <tr key={user.profile_id} className="text-sbi-muted">
                      <td className="py-3 pr-4">
                        <div className="text-white">{user.name}</div>
                        <div className="text-xs text-sbi-muted-dark">
                          {user.email || "No portal email"}
                        </div>
                      </td>
                      <td className="py-3 pr-4 capitalize">{user.role}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatNumber(user.requests)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatNumber(user.total_tokens)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCost(user.estimated_cost_usd)}
                      </td>
                      <td className="py-3 text-right">
                        {formatDate(user.last_used_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <SectionLabel>Storage</SectionLabel>
            <p className="mb-4 text-xs text-sbi-muted-dark">
              Current Supabase Storage inventory. R2 migration can be staged
              with the old buckets retained for rollback.
            </p>
            {stats.storage.length === 0 ? (
              <p className="text-sm text-sbi-muted">No stored objects.</p>
            ) : (
              <div className="space-y-3">
                {stats.storage.map((bucket) => (
                  <div
                    key={bucket.bucket_id}
                    className="flex items-center justify-between gap-4 border-b border-sbi-dark-border/30 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <HardDrive className="size-4 shrink-0 text-sbi-green" />
                      <span className="truncate text-sm text-white">
                        {bucket.bucket_id}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-sbi-muted">
                      {formatNumber(bucket.objects)} objects ·{" "}
                      {formatBytes(bucket.bytes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionLabel>Directory mix</SectionLabel>
            <div className="space-y-3">
              {Object.entries(stats.profiles.by_role).map(([role, count]) => (
                <div
                  key={role}
                  className="flex items-center justify-between border-b border-sbi-dark-border/30 pb-3 last:border-0 last:pb-0"
                >
                  <span className="capitalize text-sm text-sbi-muted">
                    {role}
                  </span>
                  <span className="text-sm tabular-nums text-white">
                    {formatNumber(count)}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex items-center gap-2 text-xs text-sbi-muted-dark">
          <FileStack className="size-3.5" />
          Storage totals are metadata estimates; token costs use the configured
          model price inputs.
          <MessageSquare className="ml-2 size-3.5" />
        </div>
      </DashboardMain>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.12em] text-sbi-muted-dark">
        {label}
      </div>
      <div className="mt-1 text-lg tabular-nums text-white">{value}</div>
    </div>
  );
}
