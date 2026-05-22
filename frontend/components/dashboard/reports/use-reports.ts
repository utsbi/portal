"use client";

import { useEffect, useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";
import { createClient } from "@/lib/supabase/client";

const STATUS_TO_DB: Record<ReportItem["status"], string> = {
  Pending: "pending",
  "In Progress": "in-progress",
  Done: "done",
  Denied: "denied",
};

export function useReports(projectId: string | number | null | undefined) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = projectId
      ? `/api/reports?project_id=${projectId}`
      : "/api/reports";
    setLoading(true);
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ReportItem[]) => {
        setReports(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId]);

  const addReport = (report: ReportItem) => {
    setReports((prev) => [report, ...prev]);
  };

  const updateStatus = async (
    id: string,
    status: ReportItem["status"],
  ): Promise<boolean> => {
    const supabase = createClient();
    const { error } = await supabase
      .from("tickets")
      .update({ status: STATUS_TO_DB[status] })
      .eq("id", id);
    if (error) {
      console.error("Failed to update report status:", error.message);
      return false;
    }
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    return true;
  };

  return { reports, loading, addReport, updateStatus };
}
