import { ExploreChat } from "@/components/dashboard/explore/DashboardPortal";

interface PageProps {
  params: Promise<{ url_slug: string }>;
}

export default async function ExplorePage({ params }: PageProps) {
  const { url_slug } = await params;

  return <ExploreChat urlSlug={url_slug} />;
}
