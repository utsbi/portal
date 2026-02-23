import { Messages } from "@/components/dashboard/messages";
import { MessagesEmptyState } from "@/components/dashboard/messages/MessagesEmptyState";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";

interface PageProps {
  params: Promise<{ url_slug: string }>;
}

export default async function MessagesPage({ params }: PageProps) {
  const { url_slug } = await params;

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          <Messages urlSlug={url_slug} />
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <MessagesEmptyState />
        </div>
      </div>
    </CreateConversationModalProvider>
  );
}
