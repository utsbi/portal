import { Messages } from "@/components/dashboard/messages";

interface PageProps {
  params: Promise<{ url_slug: string }>;
}

export default async function MessagesPage({ params }: PageProps) {
  const { url_slug } = await params;
  return <Messages urlSlug={url_slug} />;
}