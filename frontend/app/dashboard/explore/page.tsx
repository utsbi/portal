import { Suspense } from "react";
import { ExploreChat } from "@/components/dashboard/explore/DashboardPortal";

export default async function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreChat />
    </Suspense>
  );
}
