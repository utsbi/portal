import { headers } from "next/headers";
import { ReportsClient } from "@/components/dashboard/reports/reports-client";
import type { ReportItem } from "@/app/api/reports/route";

export const dynamic = "force-dynamic";

async function getReports(): Promise<ReportItem[]> {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";

    const res = await fetch(`${protocol}://${host}/api/reports`, {
      cache: "no-store",
    });

    if (!res.ok) return [];
    return res.json();
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
