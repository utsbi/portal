import { MessageThread } from "@/components/dashboard/messages/MessageThread";
import { Messages } from "@/components/dashboard/messages";
import { getConversationById } from "@/components/dashboard/messages/messages_dataplacholder";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";

interface PageProps {
  params: Promise<{ url_slug: string; conversationId: string }>;
}

// displays conversation information if the user role is client
export default async function ConversationPage({ params }: PageProps) {
  const { url_slug, conversationId } = await params;
  const conversation = getConversationById(conversationId);
  const name = conversation?.name ?? "Conversation";

  return (
    <CreateConversationModalProvider>
    <div className="flex flex-1 min-h-0 h-full">
      <div className="w-96 shrink-0 overflow-y-auto border-r border">
        <Messages urlSlug={url_slug} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex flex-col flex-1 min-h-0 h-full">
          <div className="shrink-0 px-4 py-3 border-b border">
            <p className="text-lg text-white text-center font-medium">{name}</p>
          </div>
          <div className="flex-1 min-h-0">
            <MessageThread conversationId={conversationId} name={name} lastMessage={conversation?.lastMessage}/>
          </div>
        </div>
      </div>
    </div>
    </CreateConversationModalProvider>
  );
}
