import { MessageThread } from "@/components/dashboard/messages/MessageThread";
import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { getDirectorConversationById } from "@/components/dashboard/messages/messages_dataplacholder";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";

interface PageProps {
  params: Promise<{ url_slug: string; conversationId: string }>;
}

// displays director-side conversation details
// Same two-column layout as client: list left, thread right; no back link (list is always visible).
export default async function DirectorConversationPage({ params }: PageProps) {
  const { url_slug, conversationId } = await params;
  const conversation = getDirectorConversationById(conversationId);
  const name = conversation?.name ?? "Conversation";

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          <DirectorMessages urlSlug={url_slug} />
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b border">
            <p className="text-lg text-white text-center font-medium">{name}</p>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MessageThread conversationId={conversationId} name={name} lastMessage={conversation?.lastMessage} />
          </div>
        </div>
      </div>
    </CreateConversationModalProvider>
  );
}
