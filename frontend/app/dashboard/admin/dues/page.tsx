import { Database } from "lucide-react";
import { DuesWorkspace } from "@/components/dashboard/admin/DuesWorkspace";
import { EmptyState, Panel } from "@/components/dashboard/common/ui";
import { requireDirector } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

async function allRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

export default async function AdminDuesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  // A layout is not a security boundary for a page's data loading.
  const gate = await requireDirector();
  if (!gate.ok)
    return (
      <Panel>
        <EmptyState title="Admin access required" description={gate.error} />
      </Panel>
    );

  try {
    const db = gate.supabase;
    const [periods, members, params] = await Promise.all([
      allRows((from, to) =>
        db
          .from("dues_periods")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      ),
      allRows((from, to) =>
        db
          .from("profiles")
          .select("id, name, email, role")
          .neq("role", "client")
          .order("name")
          .order("id")
          .range(from, to),
      ),
      searchParams,
    ]);
    const selected =
      periods.find((p) => String(p.id) === params.period) ?? periods[0] ?? null;
    const [accounts, payments] = selected
      ? await Promise.all([
          allRows((from, to) =>
            db
              .from("dues_accounts")
              .select("*")
              .eq("period_id", selected.id)
              .order("id")
              .range(from, to),
          ),
          allRows((from, to) =>
            db
              .from("dues_payments")
              .select("*, dues_accounts!inner(period_id)")
              .eq("dues_accounts.period_id", selected.id)
              .order("recorded_at", { ascending: false })
              .order("id", { ascending: false })
              .range(from, to),
          ),
        ])
      : [[], []];
    return (
      <DuesWorkspace
        periods={periods}
        selected={selected}
        members={members}
        accounts={accounts}
        payments={payments}
      />
    );
  } catch {
    return (
      <Panel>
        <EmptyState
          icon={<Database className="size-6" />}
          title="Dues are unavailable"
          description="The dues records could not be loaded. If this is a new installation, apply the member dues database migration, then reload this page."
        />
      </Panel>
    );
  }
}
