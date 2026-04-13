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
  const profileId = actor.profile.id;

  const numericConversationId = Number(conversationId);

  const { data: conversation, error: convoError } = await supabase
    .from("conversations")
    .select("id, client_profile_id, director_profile_id")
    .eq("id", numericConversationId)
    .maybeSingle();

  if (convoError || !conversation) {
    notFound();
  }

  let name = `Conversation ${conversationId}`;

  // Look up the other party's name from profiles
  if (isDirector && conversation.client_profile_id) {
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", conversation.client_profile_id)
      .maybeSingle();

    if (clientProfile?.name) {
      name = clientProfile.name;
    }
  } else if (!isDirector && conversation.director_profile_id) {
    const { data: directorProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", conversation.director_profile_id)
      .maybeSingle();

    if (directorProfile?.name) {
      name = directorProfile.name;
    }
  }

  return (
    <CreateConversationModalProvider>
      <div className="flex flex-1 min-h-0 h-full">
        <div className="w-96 shrink-0 overflow-y-auto border-r border">
          {isDirector ? (
            <DirectorMessages profileId={profileId} />
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
              senderRole={isDirector ? "director" : "client"}
              name={name}
            />
          </div>
        </div>
      </div>
    </CreateConversationModalProvider>
  );
}
