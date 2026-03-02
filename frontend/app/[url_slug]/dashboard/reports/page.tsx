import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ReportsClient } from "@/components/dashboard/reports/reports-client";
import type { ReportItem } from "@/app/api/reports/route";

export const dynamic = "force-dynamic";

async function getReports(): Promise<ReportItem[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        db: { schema: "Reports" },
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* read-only in Server Component */ },
        },
      },
    );

    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Reports fetch error:", error);
      return [];
    }

    return (data || []).map((item: any): ReportItem => ({
      id: item.id,
      uuid: item.uuid || item.id,
      numid: String(item.numid || item.id).padStart(4, "0"),
      title: item.title || item.subject || "Untitled Report",
      subject: item.subject,
      name: item.name,
      email: item.email,
      department: item.department || "General",
      director: item.director || item.assign_to || "Unassigned",
      assign_to: item.assign_to,
      project: item.project,
      status: item.status || "Pending",
      message: item.message,
      date: item.created_at
        ? new Date(item.created_at).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      customer_id: item.customer_id,
      attachments: item.attachments,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  } catch (e) {
    console.error("Unexpected reports error:", e);
    return [];
  }
}

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <div className="w-full h-full bg-sbi-dark">
      <ReportsClient initialReports={reports} />
    </div>
  );
}
