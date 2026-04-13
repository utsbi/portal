import { notFound } from "next/navigation";
import { MessageThread } from "@/components/dashboard/messages/MessageThread";
import { Messages } from "@/components/dashboard/messages";
import { DirectorMessages } from "@/components/dashboard/messages/DirectorMessages";
import { CreateConversationModalProvider } from "@/components/dashboard/messages/CreateConversationModalContext";
import { resolveActor } from "@/lib/project/resolve-actor";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  const actor = await resolveActor();
  if (!actor) return null;

  const supabase = await createClient();
  const isDirector = actor.profile.role === "director";

  // For directors, get their member ID
  let directorMemberId: number | undefined;
  if (isDirector) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("member_id")
      .eq("id", actor.profile.id)
      .single();
    directorMemberId = profile?.member_id ?? undefined;
  }

  const numericConversationId = Number(conversationId);

  const { data: conversation, error: convoError } = await supabase
    .from("conversations")
    .select("id, client_id, director_id")
    .eq("id", numericConversationId)
    .maybeSingle();

  if (convoError || !conversation) {
    notFound();
  }

  let name = `Conversation ${conversationId}`;

  if (isDirector && conversation.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("company_name")
      .eq("id", conversation.client_id)
      .maybeSingle();

    if (client?.company_name) {
      name = client.company_name;
    }
  } else if (!isDirector && conversation.director_id) {
    const { data: directorMember } = await supabase
      .from("members")
      .select("name")
      .eq("id", conversation.director_id)
      .maybeSingle();

    if (directorMember?.name) {
      name = directorMember.name;
    }
  }

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          {isDirector && directorMemberId ? (
            <DirectorMessages directorId={directorMemberId} />
          ) : (
            <Messages />
          )}
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-4 py-3 border-b border">
            <p className="text-lg text-white text-center font-medium">
              {name}
            </p>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MessageThread
              conversationId={conversationId}
              clientId={conversation.client_id}
              senderRole={isDirector ? "director" : "client"}
              name={name}
            />
          </div>
        </div>
      </div>
    </CreateConversationModalProvider>
  );
}
