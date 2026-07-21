import { ExplorePortal } from "@/components/dashboard/explore/DashboardPortal";

// Optional catch-all so /dashboard/explore, /dashboard/explore/new and
// /dashboard/explore/<uuid> all resolve to the same surface. ExplorePortal reads
// the chat id reactively via useParams so switching ids never remounts the page.
export default function ExplorePage() {
  return <ExplorePortal />;
}
