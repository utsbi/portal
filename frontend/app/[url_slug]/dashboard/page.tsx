import { ExploreWelcome } from "@/components/dashboard/explore/DashboardPortal";

interface PageProps {
  params: Promise<{ url_slug: string }>;
}

export default async function DashboardPage({ params }: PageProps) {
  const { url_slug } = await params;

  return <ExploreWelcome urlSlug={url_slug} />;
}
