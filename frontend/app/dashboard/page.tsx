import { redirect } from "next/navigation";

// The dashboard root is the Explore portal; send it to a fresh chat.
export default function DashboardPage() {
  redirect("/dashboard/explore/new");
}
