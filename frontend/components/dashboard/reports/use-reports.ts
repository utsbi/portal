"use client";

import { useEffect, useState } from "react";
import type { ReportItem } from "@/app/api/reports/route";

export function useReports(projectId: string | number | null | undefined) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = projectId ? `/api/reports?project_id=${projectId}` : "/api/reports";
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

  return { reports, loading, addReport };
}
