import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";

interface PageProps {
  params: Promise<{ url_slug: string }>;
}

// director-side conversation details
export default async function DirectorMessagePage({ params }: PageProps) {
  const { url_slug } = await params;
  return <DirectorMessages urlSlug={url_slug} />;
}
