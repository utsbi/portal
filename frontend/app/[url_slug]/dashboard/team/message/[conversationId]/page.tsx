import Link from "next/link";
import { MessageThread } from "@/components/dashboard/messages/MessageThread";
import { getDirectorConversationById } from "@/components/dashboard/messages/messages_dataplacholder";

interface PageProps {
  params: Promise<{ url_slug: string; conversationId: string }>;
}

// displays director-side conversation details
export default async function DirectorConversationPage({ params }: PageProps) {
  const { url_slug, conversationId } = await params;
  const conversation = getDirectorConversationById(conversationId);
  const name = conversation?.name ?? "Conversation";

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="shrink-0 px-4 py-3 border-b border">
        <Link
          href={`/${url_slug}/dashboard/team/message`}
          className="text-sm text-white"
        >
          ← Back to conversations
        </Link>
        <p className="text-lg text-white text-center font-medium mt-1">{name}</p>
      </div>
      <div className="flex-1 min-h-0">
        <MessageThread conversationId={conversationId} name={name} lastMessage={conversation?.lastMessage} />
      </div>
    </div>
  );
}