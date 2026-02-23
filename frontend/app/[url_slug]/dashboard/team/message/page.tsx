import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { MessagesEmptyState } from "@/components/dashboard/messages/MessagesEmptyState";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";

interface PageProps {
  params: Promise<{ url_slug: string }>;
}

// director-side conversation details
// Same two-column layout as client messages: list left, empty state right; provider lets empty-state button open DirectorMessages modal.
export default async function DirectorMessagePage({ params }: PageProps) {
  const { url_slug } = await params;

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          <DirectorMessages urlSlug={url_slug} />
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <MessagesEmptyState />
        </div>
      </div>
    </CreateConversationModalProvider>
  );
}
