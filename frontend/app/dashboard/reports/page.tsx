import { ReportsClient } from "@/components/dashboard/reports/reports-client";

// Skip server-side fetch entirely — ReportsClient fetches from Supabase client-side on mount.
// This makes the page render instantly with a skeleton, then populate.
export default function ReportsPage() {
  return (
    <div className="w-full h-full bg-sbi-dark">
      <ReportsClient initialReports={[]} />
    </div>
  );
}
