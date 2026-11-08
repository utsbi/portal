import { redirect } from "next/navigation";

// Preserve existing bookmarks after promoting stats to the Admin overview.
export default function AdminStatsPage() {
  redirect("/dashboard/admin");
}
